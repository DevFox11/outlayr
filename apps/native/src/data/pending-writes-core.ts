import { and, desc, eq, isNull, like } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { detectCurrency } from "@/domain/detect-currency";
import type { CardAccountCandidate } from "@/domain/match-card-account";
import { matchCardAccount } from "@/domain/match-card-account";
import { parseNotification } from "@/domain/parse-notification";
import type { ClaimedWrites, PendingWrite } from "@/lib/pending-writes-core";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { suggestedCardFee } from "./card-fees-core";
import { transactionsRepo } from "./transactions-core";

/**
 * How far apart two Wallet runs may be and still be read as one purchase.
 *
 * A Transaction automation fires when the card authorizes and can fire again
 * when the charge settles; the two runs describe one purchase but arrive as two
 * intents. Ten minutes covers the pair when settlement is immediate, a Shortcuts
 * retry, and a drain replayed after a force-quit. `PushLedger` in
 * `app-intents/SharedStore.swift` copies it to push once per purchase.
 *
 * It deliberately does not stretch to a next-day settlement. Widening it to
 * cover that would also collapse a second, real purchase at the same merchant
 * for the same amount, and a row the user never made is unrecoverable in a way
 * that a duplicate they can delete is not. An automation that can pass a Wallet
 * transaction identifier gets exact matching instead, with no window at all —
 * see `LogWalletTransactionIntent`.
 */
export const WALLET_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/** What `META_KEYS.lastWalletEntry` holds. */
export interface LastWalletEntry {
    /** Epoch ms of the commit, not of the purchase. */
    at: number;
    txId: string;
}

const lastWalletEntrySchema = z.object({ at: z.number().finite(), txId: z.string() });

/** Null when nothing has come through Wallet yet, or the value is unreadable. */
export function parseLastWalletEntry(raw: string | null | undefined): LastWalletEntry | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = lastWalletEntrySchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

const walletCardSchema = z.object({
    accountId: z.string().nullable().optional(),
    lastAt: z.number().finite(),
    text: z.string(),
});

export type WalletCard = z.infer<typeof walletCardSchema>;

const walletCardsSchema = z.array(walletCardSchema.nullable().catch(null));

export function parseWalletCards(raw: string | null | undefined): WalletCard[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed = walletCardsSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.filter((card) => card !== null) : [];
    } catch {
        return [];
    }
}

export function cardAccountId(
    text: string,
    cards: readonly WalletCard[],
    candidates: readonly CardAccountCandidate[]
): string | null {
    const picked = cards.find((card) => card.text === text)?.accountId;
    if (picked === null) {
        return null;
    }
    if (picked !== undefined && candidates.some((candidate) => candidate.id === picked)) {
        return picked;
    }
    return matchCardAccount(text, candidates);
}

export async function pickCardAccount(db: Database, text: string, accountId: string | null): Promise<void> {
    const cards = parseWalletCards(await getMeta(db, META_KEYS.walletCards));
    const next = cards.map((card) => (card.text === text ? { ...card, accountId } : card));
    await setMeta(db, META_KEYS.walletCards, JSON.stringify(next));
}

async function rememberCard(db: Database, text: string, at: number): Promise<void> {
    const cards = parseWalletCards(await getMeta(db, META_KEYS.walletCards));
    const next = cards.some((card) => card.text === text)
        ? cards.map((card) => (card.text === text ? { ...card, lastAt: Math.max(card.lastAt, at) } : card))
        : [...cards, { lastAt: at, text }];
    await setMeta(db, META_KEYS.walletCards, JSON.stringify(next));
}

/**
 * A job an automation produced, as opposed to a spoken one. The card is the
 * sure sign; the key prefixes cover an automation built before the card
 * parameter existed.
 */
function fromAutomation(job: PendingWrite): boolean {
    return Boolean(job.card?.trim()) || /^(?:wallet|notification):/.test(job.dedupeKey ?? "");
}

/** A notification job with its amount and merchant filled in, or null when it names no purchase. */
function readNotification(job: PendingWrite): PendingWrite | null {
    if (!job.text) {
        return job;
    }
    const parsed = parseNotification(job.text);
    if (!parsed) {
        return null;
    }
    return { ...job, amount: parsed.amount, amountText: parsed.amountText, note: parsed.merchant ?? "" };
}

const LEDGER_LIMIT = 100;
const LEDGER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface LedgerEntry {
    at: number;
    /** The enqueue this row came from. */
    id: string;
    /** The purchase it came from, when the intent could name one. */
    key: string | null;
    txId: string;
}

const ledgerSchema = z.array(
    z
        .object({
            at: z.number().finite(),
            id: z.string(),
            key: z.string().nullable(),
            txId: z.string(),
        })
        // Per entry, so one bad row does not discard a ledger that is otherwise
        // the only record of which purchases have already been committed.
        .nullable()
        .catch(null)
);

async function readLedger(db: Database): Promise<LedgerEntry[]> {
    const raw = await getMeta(db, META_KEYS.pendingWriteLedger);
    if (!raw) {
        return [];
    }
    try {
        const parsed = ledgerSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.filter((entry) => entry !== null) : [];
    } catch {
        return [];
    }
}

/**
 * Records the row this job produced, replacing anything it recorded before.
 *
 * Appending would leave two entries under one enqueue id, and `alreadyApplied`
 * answers with the FIRST — so after a deleted duplicate sent a job round again,
 * every later replay would keep re-checking the transaction the user deleted,
 * find it gone, and write another one.
 */
function remember(ledger: LedgerEntry[], entry: LedgerEntry, at: number): LedgerEntry[] {
    return [...ledger.filter((kept) => kept.id !== entry.id), entry]
        .filter((kept) => at - kept.at <= LEDGER_RETENTION_MS)
        .slice(-LEDGER_LIMIT);
}

/**
 * The row this job already produced, if any.
 *
 * The enqueue id matches with no window because the same id can only ever be the
 * same enqueue arriving twice — a queue file replayed after an interrupted
 * drain. The purchase key is windowed because two runs naming one purchase are
 * two separate intents, and far enough apart they stop being one.
 */
function alreadyApplied(ledger: LedgerEntry[], job: PendingWrite, at: number): LedgerEntry | null {
    const replayed = ledger.find((entry) => entry.id === job.id);
    if (replayed) {
        return replayed;
    }
    const key = job.dedupeKey?.trim();
    if (!key) {
        return null;
    }
    return ledger.find((entry) => entry.key === key && at - entry.at <= WALLET_DEDUPE_WINDOW_MS) ?? null;
}

/**
 * A tombstone must not block. The user deleting a duplicate is them saying the
 * charge belongs on the ledger once; re-running the automation after that has to
 * be able to put it back.
 */
async function stillOnLedger(db: Database, txId: string): Promise<boolean> {
    const rows = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.id, txId), isNull(transactions.deletedAt)))
        .limit(1);
    return rows[0] != null;
}

/**
 * Commits every transaction an App Intent accepted while the app was not
 * running, and answers how many landed. Goes through the same
 * `transactionsRepo.create` the form uses.
 *
 * Each committed job is recorded against the row it produced, in the same
 * SQLite transaction as the insert, which is what makes a replayed queue file
 * safe: the queue delivers at least once and this collapses it to exactly once.
 */
export async function applyPendingWrites(db: Database, jobs: PendingWrite[], now: Date = new Date()): Promise<number> {
    if (jobs.length === 0) {
        return 0;
    }
    const at = now.getTime();
    let ledger = await readLedger(db);
    let applied = 0;

    /* oxlint-disable no-await-in-loop -- exactly-once depends on this job seeing the ledger row the previous job's SQLite transaction committed, so the jobs must land one at a time */
    for (const queued of jobs) {
        const job = readNotification(queued);
        if (!job) {
            continue;
        }
        const seen = alreadyApplied(ledger, job, at);
        if (seen && (await stillOnLedger(db, seen.txId))) {
            continue;
        }
        const categoryId = await resolveCategory(db, job);
        if (!categoryId) {
            // Dropping beats inventing a category the user never made.
            console.warn("[outlayr] dropped a queued entry with no category");
            continue;
        }
        const account = await resolveAccount(db, job);
        const currency = resolveWriteCurrency(job, account);
        // oxlint-disable-next-line no-loop-func -- awaited in place, so nothing outlives the iteration whose `job`, `categoryId` and `account` it reads
        await withTransaction(db, async () => {
            const txId = await transactionsRepo.create(db, {
                accountId: account?.id ?? null,
                amount: job.amount,
                categoryId,
                // Null means "the ledger's own currency", which is what
                // `transactionsRepo.create` already resolves it to.
                currency,
                date: new Date(job.date),
                details: null,
                fee: job.income ? null : suggestedCardFee(db, { account, categoryId, currency, merchant: job.note }),
                income: job.income,
                note: job.note,
            });
            ledger = remember(ledger, { at, id: job.id, key: job.dedupeKey?.trim() || null, txId }, at);
            await setMeta(db, META_KEYS.pendingWriteLedger, JSON.stringify(ledger));
            if (fromAutomation(job)) {
                const entry: LastWalletEntry = { at, txId };
                await setMeta(db, META_KEYS.lastWalletEntry, JSON.stringify(entry));
            }
            const card = job.card?.trim();
            if (card) {
                await rememberCard(db, card, job.date);
            }
        });
        applied += 1;
    }
    /* oxlint-enable no-await-in-loop */

    return applied;
}

interface MatchedAccount {
    currency: string;
    id: string;
}

/**
 * The account a Wallet card maps to: the one the user picked for that card in
 * Settings, else a confident name match, else null — see `cardAccountId`.
 */
async function resolveAccount(db: Database, job: PendingWrite): Promise<MatchedAccount | null> {
    const card = job.card?.trim();
    if (!card) {
        return null;
    }
    const rows = await db
        .select({ currency: accounts.currency, id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(isNull(accounts.deletedAt));
    const id = cardAccountId(card, parseWalletCards(await getMeta(db, META_KEYS.walletCards)), rows);
    const matched = rows.find((row) => row.id === id);
    return matched ? { currency: matched.currency, id: matched.id } : null;
}

/**
 * The currency a queued entry was actually in, or null to use the ledger's.
 *
 * An explicit code from the automation wins; otherwise the formatted amount is
 * read for one. When the symbol cannot pin a single currency ("$" is on 22 of
 * them) the card's account answers, since a card charges in its account's
 * currency. Only with neither does it stay null — see `detectCurrency`.
 */
function resolveWriteCurrency(job: PendingWrite, account: MatchedAccount | null): string | null {
    const pinned = job.currency?.trim().toUpperCase();
    if (pinned) {
        return pinned;
    }
    return detectCurrency(job.amountText) ?? account?.currency ?? null;
}

/**
 * Works out where a queued entry belongs, best evidence first.
 *
 * 1. The category the intent named. A spoken name arrives with whatever casing
 *    Siri chose, so the match is case-insensitive.
 * 2. Failing that, wherever this same merchant was filed last time — a Wallet
 *    automation only ever knows a merchant string, never a category.
 * 3. Failing that, the first category on the right side of the ledger.
 */
async function resolveCategory(db: Database, job: PendingWrite): Promise<string | null> {
    if (job.category) {
        const named = await db
            .select({ id: categories.id })
            .from(categories)
            .where(
                and(
                    like(categories.name, job.category),
                    eq(categories.income, job.income),
                    isNull(categories.deletedAt)
                )
            )
            .limit(1);
        if (named[0]) {
            return named[0].id;
        }
    }

    const note = job.note.trim();
    if (note) {
        const seenBefore = await db
            .select({ categoryId: transactions.categoryId })
            .from(transactions)
            .where(
                and(like(transactions.note, note), eq(transactions.income, job.income), isNull(transactions.deletedAt))
            )
            .orderBy(desc(transactions.date))
            .limit(1);
        const previous = seenBefore[0]?.categoryId;
        if (previous) {
            return previous;
        }
    }

    const fallback = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.income, job.income), isNull(categories.parentId), isNull(categories.deletedAt)))
        .limit(1);
    return fallback[0]?.id ?? null;
}

let draining: Promise<number> | null = null;

/**
 * Claims the queue, applies it, and releases it — one drain at a time.
 *
 * The guard is the point. `claimPendingWrites` deliberately re-returns a claim
 * an earlier pass has not released yet, because that is how a crash mid-drain is
 * recovered — so a second drain starting while the first is still awaiting its
 * per-job SQLite transactions receives the very same jobs. Both read the
 * idempotency ledger before either has written to it, so both pass
 * `alreadyApplied` and both insert: one Wallet tap or Siri entry lands in the
 * ledger twice.
 *
 * That overlap is ordinary, not exotic. The catch-up runs from the effect body
 * at mount and again on the first `AppState` "active", which on a cold launch
 * arrives a few hundred milliseconds later. `logo-backfill` holds its own pass
 * the same way.
 */
export function drainPendingWrites(
    db: Database,
    claim: () => ClaimedWrites,
    release: (claimed: ClaimedWrites) => void
): Promise<number> {
    draining ??= runDrain(db, claim, release).finally(() => {
        draining = null;
    });
    return draining;
}

async function runDrain(
    db: Database,
    claim: () => ClaimedWrites,
    release: (claimed: ClaimedWrites) => void
): Promise<number> {
    const claimed = claim();
    if (claimed.names.length === 0) {
        return 0;
    }
    const applied = await applyPendingWrites(db, claimed.jobs);
    release(claimed);
    return applied;
}
