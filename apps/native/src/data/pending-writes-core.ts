import { and, desc, eq, isNull, like } from "drizzle-orm";

import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { detectCurrency } from "@/domain/detect-currency";
import type { PendingWrite } from "@/lib/pending-writes-core";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { transactionsRepo } from "./transactions-core";

/**
 * How far apart two Wallet runs may be and still be read as one purchase.
 *
 * A Transaction automation fires when the card authorizes and can fire again
 * when the charge settles; the two runs describe one purchase but arrive as two
 * intents. Ten minutes covers the pair when settlement is immediate, a Shortcuts
 * retry, and a drain replayed after a force-quit.
 *
 * It deliberately does not stretch to a next-day settlement. Widening it to
 * cover that would also collapse a second, real purchase at the same merchant
 * for the same amount, and a row the user never made is unrecoverable in a way
 * that a duplicate they can delete is not. An automation that can pass a Wallet
 * transaction identifier gets exact matching instead, with no window at all —
 * see `LogWalletTransactionIntent`.
 */
export const WALLET_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

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

function isLedgerEntry(value: unknown): value is LedgerEntry {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.id === "string" &&
        (entry.key === null || typeof entry.key === "string") &&
        typeof entry.txId === "string" &&
        typeof entry.at === "number" &&
        Number.isFinite(entry.at)
    );
}

async function readLedger(db: Database): Promise<LedgerEntry[]> {
    const raw = await getMeta(db, META_KEYS.pendingWriteLedger);
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isLedgerEntry) : [];
    } catch {
        return [];
    }
}

function remember(ledger: LedgerEntry[], entry: LedgerEntry, at: number): LedgerEntry[] {
    return [...ledger, entry].filter((kept) => at - kept.at <= LEDGER_RETENTION_MS).slice(-LEDGER_LIMIT);
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
    for (const job of jobs) {
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
        // oxlint-disable-next-line no-loop-func -- awaited in place, so nothing outlives the iteration whose `job` and `categoryId` it reads
        await withTransaction(db, async () => {
            const txId = await transactionsRepo.create(db, {
                amount: job.amount,
                categoryId,
                // Null means "the ledger's own currency", which is what
                // `transactionsRepo.create` already resolves it to.
                currency: resolveWriteCurrency(job),
                date: new Date(job.date),
                details: null,
                income: job.income,
                note: job.note,
            });
            ledger = remember(ledger, { at, id: job.id, key: job.dedupeKey?.trim() || null, txId }, at);
            await setMeta(db, META_KEYS.pendingWriteLedger, JSON.stringify(ledger));
        });
        applied += 1;
    }
    /* oxlint-enable no-await-in-loop */

    return applied;
}

/**
 * The currency a queued entry was actually in, or null to use the ledger's.
 *
 * An explicit code from the automation wins; otherwise the formatted amount is
 * read for one. Anything the catalog cannot pin to a single currency stays null
 * — see `detectCurrency`.
 */
function resolveWriteCurrency(job: PendingWrite): string | null {
    const pinned = job.currency?.trim().toUpperCase();
    if (pinned) {
        return pinned;
    }
    return detectCurrency(job.amountText);
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
