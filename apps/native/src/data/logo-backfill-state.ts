import { inArray } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import type { SpendDb } from "./budget-spent";

/**
 * Enough to cover every row the logo backfill can reach: its window is
 * fourteen days, and a hundred hand-removed logos in that time is not a
 * ledger anyone keeps.
 */
const DISMISSAL_LIMIT = 200;

/**
 * Every write here is a read-modify-write of one JSON value, and two saves
 * can overlap — the Wallet drain on foreground and a form save, say. Chained
 * through one promise so the second read sees the first write; a lock holder
 * only ever awaits its own statements, so a caller inside `withTransaction`
 * cannot deadlock one outside it on the shared connection.
 */
let chain: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = chain.then(task, task);
    chain = next.catch(() => undefined);
    return next;
}

const idList = z.array(z.string());

async function readIds(db: SpendDb, key: string): Promise<string[]> {
    const raw = await getMeta(db, key);
    if (!raw) {
        return [];
    }
    try {
        const parsed = idList.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : [];
    } catch {
        return [];
    }
}

/**
 * The rows whose logo the user took off on purpose. The row itself cannot
 * say so — a removed logo and a logo that never arrived both leave every
 * identity column null — and without this the backfill would put back the
 * exact image the user just removed, on the next launch.
 */
export async function dismissedLogoIds(db: SpendDb): Promise<Set<string>> {
    return new Set(await readIds(db, META_KEYS.logoDismissals));
}

/** The row was given a different merchant: the old refusal was about the old one. */
export function forgetLogoDismissal(db: SpendDb, id: string): Promise<void> {
    return serialized(async () => {
        const ids = await dismissedLogoIds(db);
        if (ids.delete(id)) {
            await setMeta(db, META_KEYS.logoDismissals, JSON.stringify([...ids]));
        }
    });
}

/** Newest last; the oldest fall off the front. */
export function rememberLogoDismissal(db: SpendDb, id: string): Promise<void> {
    return serialized(async () => {
        const ids = await dismissedLogoIds(db);
        ids.delete(id);
        const kept = [...ids, id].slice(-DISMISSAL_LIMIT);
        await setMeta(db, META_KEYS.logoDismissals, JSON.stringify(kept));
    });
}

const stampedIds = z.record(z.string(), z.number().finite());

async function readStamped(db: SpendDb, key: string): Promise<Record<string, number>> {
    const raw = await getMeta(db, key);
    if (!raw) {
        return {};
    }
    try {
        const parsed = stampedIds.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : {};
    } catch {
        return {};
    }
}

/**
 * Rows this device last wrote without an identity, by the row's `updatedAt`
 * as written. The backfill only ever works a row whose `updatedAt` still
 * matches: one that arrived by sync, or that a peer has edited since, is the
 * other device's to paint (its photo arrives with it), and a logo the user
 * removed over there must not be reasoned back into existence here. Entries
 * older than `keepMs` are dropped on write.
 */
export async function candidateLogoIds(db: SpendDb): Promise<Map<string, number>> {
    return new Map(Object.entries(await readStamped(db, META_KEYS.logoCandidates)));
}

export function rememberLogoCandidates(db: SpendDb, ids: readonly string[], at: number, keepMs: number): Promise<void> {
    return serialized(async () => {
        const candidates = await candidateLogoIds(db);
        for (const id of ids) {
            candidates.set(id, at);
        }
        for (const [candidate, stamped] of candidates) {
            if (at - stamped > keepMs) {
                candidates.delete(candidate);
            }
        }
        await setMeta(db, META_KEYS.logoCandidates, JSON.stringify(Object.fromEntries(candidates)));
    });
}

export async function rememberLogoCandidate(db: SpendDb, id: string, at: number, keepMs: number): Promise<void> {
    await rememberLogoCandidates(db, [id], at, keepMs);
}

/**
 * Moves candidates' stamps to the `updatedAt` a local write is about to give
 * their rows. Every local path that touches a row's `updatedAt` without
 * giving it an identity has to call this BEFORE its write, inside the same
 * transaction — advancing a subscription, ending one, lifting a tombstone,
 * detaching an account — or the row reads as a peer's edit and is never
 * painted. The rows are read live here rather than trusted from the caller:
 * a peer's edit can land between a caller's snapshot and its queued
 * transaction, and only a candidate whose stamp matches the row as it is now
 * moves. One a peer already retired stays retired, and a row that was never a
 * candidate stays that way.
 */
export function refreshLogoCandidates(db: Database, ids: readonly string[], at: number): Promise<void> {
    if (ids.length === 0) {
        return Promise.resolve();
    }
    return serialized(async () => {
        const candidates = await candidateLogoIds(db);
        const live = await db
            .select({ id: transactions.id, updatedAt: transactions.updatedAt })
            .from(transactions)
            .where(inArray(transactions.id, [...ids]));
        let moved = false;
        for (const row of live) {
            if (candidates.get(row.id) === row.updatedAt.getTime()) {
                candidates.set(row.id, at);
                moved = true;
            }
        }
        if (moved) {
            await setMeta(db, META_KEYS.logoCandidates, JSON.stringify(Object.fromEntries(candidates)));
        }
    });
}

export async function refreshLogoCandidate(db: Database, id: string, at: number): Promise<void> {
    await refreshLogoCandidates(db, [id], at);
}

/**
 * Whether the row, as it is now, is this device's to paint: a candidate whose
 * stamp matches its live `updatedAt`, and not dismissed. Read inside the
 * caller's transaction for the same reason `refreshLogoCandidates` reads live.
 */
export async function isLiveLogoCandidate(db: Database, id: string): Promise<boolean> {
    const [row] = await db
        .select({ updatedAt: transactions.updatedAt })
        .from(transactions)
        .where(inArray(transactions.id, [id]));
    if (row == null) {
        return false;
    }
    const candidates = await candidateLogoIds(db);
    const dismissed = await dismissedLogoIds(db);
    return candidates.get(id) === row.updatedAt.getTime() && !dismissed.has(id);
}

/** Matches the backfill's own window; a candidate older than that is never read. */
export const LOGO_CANDIDATE_KEEP_MS = 14 * 24 * 60 * 60 * 1000;

/** A row saved with its category tile and a name: the backfill's to finish. */
export function isLogoCandidate(row: {
    emoji?: string | null;
    icon?: string | null;
    imageKey?: string | null;
    imageUri?: string | null;
    note?: string | null;
}): boolean {
    const bare = row.icon == null && row.emoji == null && row.imageUri == null && row.imageKey == null;
    return bare && (row.note ?? "").trim().length > 0;
}

/** Deadlines older than the backfill's own window can never matter again. */
const RETRY_DEADLINE_KEEP_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Merchant group id -> the time before which it is not asked again. Kept
 * across launches, since a cold start is exactly when a pass runs and a
 * fresh map on every one would spend the model budget on the same misses.
 * An expired deadline is kept too: it is what tells a pass that this name
 * was tried before, so the names never tried go first.
 */
export async function readRetryDeadlines(db: SpendDb, now: number): Promise<Map<string, number>> {
    const stamped = await readStamped(db, META_KEYS.logoBackfillRetries);
    return new Map(Object.entries(stamped).filter(([, until]) => now - until < RETRY_DEADLINE_KEEP_MS));
}

export function writeRetryDeadlines(db: SpendDb, deadlines: Map<string, number>): Promise<void> {
    return serialized(() => setMeta(db, META_KEYS.logoBackfillRetries, JSON.stringify(Object.fromEntries(deadlines))));
}
