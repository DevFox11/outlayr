import type { RateLookup } from "@outlayr/money";
import { and, desc, eq, lte } from "drizzle-orm";
import { getMeta, setMeta } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { appMeta, exchangeRates } from "@/db/schema";

/** 12 hours. */
export const RATES_THROTTLE_MS = 43_200_000;

/**
 * Rows per chunked INSERT. `exchangeRates` binds 6 params per row, so SQLite's
 * 32,766 bound-parameter cap admits at most 5,461 rows per statement — 2,000
 * leaves margin for driver variance.
 */
export const RATE_ROWS_PER_CHUNK = 2000;

const LAST_PULL_KEY = "lastRatesPullAt";

export interface RateWireRow {
	quote: string;
	rateType: string;
	date: string;
	rate: number;
	source: string;
	fetchedAt: number;
}

export interface PullRatesPage {
	rows: RateWireRow[];
	windowStart: string;
	/** Absent or null ends the walk. */
	nextCursor?: number | null;
}

/** Injected so the pull logic never imports the Convex client. */
export type PullRatesFn = (args?: {
	cursor?: number;
}) => Promise<PullRatesPage>;

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < rows.length; start += size) {
		chunks.push(rows.slice(start, start + size));
	}
	return chunks;
}

/**
 * A backward clock jump puts the recorded pull in the future, which would hold
 * the throttle shut until the clock caught up. That counts as expired instead,
 * and the pull re-anchors the stamp.
 */
export function isThrottled(last: number | null, now: number): boolean {
	if (last === null) {
		return false;
	}
	const elapsed = now - last;
	if (elapsed < 0) {
		return false;
	}
	return elapsed < RATES_THROTTLE_MS;
}

async function fetchAllRates(pull: PullRatesFn): Promise<RateWireRow[]> {
	const all: RateWireRow[] = [];
	let cursor: number | undefined;
	for (;;) {
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
	db: SpendDb,
	pull: PullRatesFn,
	options: { force?: boolean; now?: number } = {},
): Promise<boolean> {
	const now = options.now ?? Date.now();
	if (!options.force) {
		const raw = await getMeta(db, LAST_PULL_KEY);
		const last = raw === null ? null : Number.parseInt(raw, 10);
		if (isThrottled(Number.isNaN(last as number) ? null : last, now)) {
			return false;
		}
	}

	const rows = await fetchAllRates(pull);
	if (rows.length === 0) {
		return false;
	}

	const mapped = rows.map((row) => ({
		quote: row.quote,
		rateType: row.rateType,
		date: row.date,
		rate: row.rate,
		source: row.source,
		fetchedAt: row.fetchedAt,
	}));

	await db.transaction(async (tx) => {
		await tx.delete(exchangeRates);
		for (const part of chunkRows(mapped, RATE_ROWS_PER_CHUNK)) {
			await tx.insert(exchangeRates).values(part);
		}
		await tx
			.insert(appMeta)
			.values({ key: LAST_PULL_KEY, value: String(now) })
			.onConflictDoUpdate({
				target: appMeta.key,
				set: { value: String(now) },
			});
	});

	return true;
}

/**
 * The `@outlayr/money` rate port, backed by the local replica. "Newest row on or
 * before this date" is what covers the weekend and holiday gaps in the ECB feed.
 */
export function localRateLookup(db: SpendDb): RateLookup {
	return async (quote, rateType, date) => {
		const rows = await db
			.select({ rate: exchangeRates.rate, date: exchangeRates.date })
			.from(exchangeRates)
			.where(
				and(
					eq(exchangeRates.quote, quote),
					eq(exchangeRates.rateType, rateType),
					lte(exchangeRates.date, date),
				),
			)
			.orderBy(desc(exchangeRates.date))
			.limit(1);
		const row = rows[0];
		return row ? { rate: row.rate, date: row.date } : null;
	};
}

export async function setLastRatesPullAt(
	db: SpendDb,
	at: number,
): Promise<void> {
	await setMeta(db, LAST_PULL_KEY, String(at));
}
