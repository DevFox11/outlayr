import type { RateLookup } from "@outlayr/money/rates";
import { and, desc, eq, lte, sql } from "drizzle-orm";

import { getMeta, setMeta } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { bumpRatesRevision } from "@/data/rates-revision";
import type { Database } from "@/db/client";
import { appMeta, exchangeRates } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { chunkRows } from "@/lib/chunk";

/** 12 hours. */
export const RATES_THROTTLE_MS = 43_200_000;

export const RECENT_RATES_THROTTLE_MS = 900_000;

/**
 * Rows per chunked INSERT. `exchangeRates` binds 6 params per row, so SQLite's
 * 32,766 bound-parameter cap admits at most 5,461 rows per statement — 2,000
 * leaves margin for driver variance.
 */
export const RATE_ROWS_PER_CHUNK = 2000;

const LAST_PULL_KEY = "lastRatesPullAt";
const LAST_RECENT_PULL_KEY = "lastRecentRatesPullAt";

export interface RateWireRow {
    date: string;
    fetchedAt: number;
    quote: string;
    rate: number;
    rateType: string;
    source: string;
}

export interface PullRatesPage {
    /** Absent or null ends the walk. */
    nextCursor?: number | null;
    rows: RateWireRow[];
    windowStart: string;
}

/** Injected so the pull logic never imports the Convex client. */
export type PullRatesFn = (args?: { cursor?: number }) => Promise<PullRatesPage>;

export type PullRecentRatesFn = () => Promise<RateWireRow[]>;

/**
 * A backward clock jump puts the recorded pull in the future, which would hold
 * the throttle shut until the clock caught up. That counts as expired instead,
 * and the pull re-anchors the stamp.
 */
export function isThrottled(last: number | null, now: number, throttleMs = RATES_THROTTLE_MS): boolean {
    if (last === null) {
        return false;
    }
    const elapsed = now - last;
    if (elapsed < 0) {
        return false;
    }
    return elapsed < throttleMs;
}

async function lastPullAt(db: Database, key: string): Promise<number | null> {
    const raw = await getMeta(db, key);
    if (raw === null) {
        return null;
    }
    const last = Number.parseInt(raw, 10);
    return Number.isNaN(last) ? null : last;
}

function toRateRow({ date, fetchedAt, quote, rate, rateType, source }: RateWireRow) {
    return { date, fetchedAt, quote, rate, rateType, source };
}

async function fetchAllRates(pull: PullRatesFn): Promise<RateWireRow[]> {
    const all: RateWireRow[] = [];
    let cursor: number | undefined;
    for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- each page's nextCursor is the only way to address the next one, so the walk cannot be parallelised
        const page = await pull(cursor === undefined ? undefined : { cursor });
        all.push(...page.rows);
        const next = page.nextCursor;
        if (next === null || next === undefined) {
            return all;
        }
        cursor = next;
    }
}

/**
 * Wipe-and-replaces the local cache in a SINGLE transaction, so no read ever
 * observes a half-cleared table.
 *
 * An EMPTY snapshot is a no-op: a stale cache beats an emptied one, so neither
 * the wipe nor the stamp happens and the next run retries.
 *
 * Answers whether a pull actually landed (false when throttled or empty).
 */
export async function pullRatesIfDue(
    db: Database,
    pull: PullRatesFn,
    options: { force?: boolean; now?: number } = {}
): Promise<boolean> {
    const now = options.now ?? Date.now();
    if (!options.force && isThrottled(await lastPullAt(db, LAST_PULL_KEY), now)) {
        return false;
    }

    const rows = await fetchAllRates(pull);
    if (rows.length === 0) {
        return false;
    }

    const mapped = rows.map(toRateRow);

    await withTransaction(db, async () => {
        await db.delete(exchangeRates);
        for (const part of chunkRows(mapped, RATE_ROWS_PER_CHUNK)) {
            // oxlint-disable-next-line no-await-in-loop -- these inserts share the one open withTransaction connection, which serialises statements anyway
            await db.insert(exchangeRates).values(part);
        }
        await db
            .insert(appMeta)
            .values({ key: LAST_PULL_KEY, value: String(now) })
            .onConflictDoUpdate({
                set: { value: String(now) },
                target: appMeta.key,
            });
    });

    // After the commit, never inside it: a screen invalidated against a
    // half-replaced cache would re-read rows that a rollback is about to remove.
    bumpRatesRevision();

    return true;
}

export async function pullRecentRatesIfDue(
    db: Database,
    pull: PullRecentRatesFn,
    options: { now?: number } = {}
): Promise<boolean> {
    const now = options.now ?? Date.now();
    if (isThrottled(await lastPullAt(db, LAST_RECENT_PULL_KEY), now, RECENT_RATES_THROTTLE_MS)) {
        return false;
    }

    const rows = await pull();
    if (rows.length === 0) {
        return false;
    }

    await withTransaction(db, async () => {
        await db
            .insert(exchangeRates)
            .values(rows.map(toRateRow))
            .onConflictDoUpdate({
                set: {
                    fetchedAt: sql`excluded.fetchedAt`,
                    rate: sql`excluded.rate`,
                    source: sql`excluded.source`,
                },
                target: [exchangeRates.quote, exchangeRates.rateType, exchangeRates.date],
            });
        await setMeta(db, LAST_RECENT_PULL_KEY, String(now));
    });

    bumpRatesRevision();

    return true;
}

/**
 * The `@outlayr/money` rate port, backed by the local replica. "Newest row on or
 * before this date" is what covers the weekend and holiday gaps in the ECB feed.
 */
export function localRateLookup(db: SpendDb): RateLookup {
    return async (quote, rateType, date) => {
        const rows = await db
            .select({ date: exchangeRates.date, rate: exchangeRates.rate })
            .from(exchangeRates)
            .where(
                and(eq(exchangeRates.quote, quote), eq(exchangeRates.rateType, rateType), lte(exchangeRates.date, date))
            )
            .orderBy(desc(exchangeRates.date))
            .limit(1);
        const [row] = rows;
        return row ? { date: row.date, rate: row.rate } : null;
    };
}
