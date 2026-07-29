import assert from "node:assert/strict";
import { describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { appMeta, exchangeRates } from "@/db/schema";
import {
	chunkRows,
	isThrottled,
	type PullRatesPage,
	pullRatesIfDue,
	RATE_ROWS_PER_CHUNK,
	RATES_THROTTLE_MS,
	type RateWireRow,
} from "./rates";
import { ratesRevision, subscribeRatesRevision } from "./rates-revision";

describe("chunkRows", () => {
	it("splits into contiguous chunks with a possibly short tail", () => {
		assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
	});

	it("returns nothing for an empty input", () => {
		assert.deepEqual(chunkRows([], 10), []);
	});

	it("keeps a full snapshot under SQLite's bound-parameter cap", () => {
		// 6 bound params per row against SQLite's 32,766 ceiling.
		assert.ok(RATE_ROWS_PER_CHUNK * 6 < 32_766);
	});
});

describe("isThrottled", () => {
	const now = 1_700_000_000_000;

	it("lets the first ever pull through", () => {
		assert.equal(isThrottled(null, now), false);
	});

	it("holds inside the window and opens on its edge", () => {
		assert.equal(isThrottled(now - 1, now), true);
		assert.equal(isThrottled(now - RATES_THROTTLE_MS + 1, now), true);
		assert.equal(isThrottled(now - RATES_THROTTLE_MS, now), false);
	});

	it("treats a backward clock jump as expired rather than locking shut", () => {
		// A stamp in the future would otherwise hold the throttle closed until
		// the clock caught up — potentially hours with no rates.
		assert.equal(isThrottled(now + 60_000, now), false);
	});
});

/**
 * better-sqlite3 has no async transaction API, and `withTransaction` runs the
 * task bare against a client that lacks one — which would make an atomicity
 * assertion vacuous. This mirrors expo-sqlite's own `withTransactionAsync`
 * (`SQLiteDatabase.ts:140-149`) statement for statement so the boundary under
 * test is the one production takes.
 */
function withAsyncTransactions(sqlite: BetterSqlite3.Database): void {
	Object.assign(sqlite, {
		withTransactionAsync: async (task: () => Promise<void>) => {
			try {
				sqlite.exec("BEGIN");
				await task();
				sqlite.exec("COMMIT");
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	});
}

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	withAsyncTransactions(sqlite);
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
		CREATE TABLE exchangeRates (
			quote text NOT NULL,
			rateType text NOT NULL,
			date text NOT NULL,
			rate real NOT NULL,
			source text NOT NULL,
			fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const NOW = 1_700_000_000_000;

function wireRow(quote: string, date: string): RateWireRow {
	return {
		quote,
		rateType: "official",
		date,
		rate: 0.9,
		source: "frankfurter",
		fetchedAt: NOW,
	};
}

/** Answers one page per call, walking the cursor the caller feeds back. */
function pagedPuller(pages: RateWireRow[][]): {
	pull: (args?: { cursor?: number }) => Promise<PullRatesPage>;
	calls: (number | undefined)[];
} {
	const calls: (number | undefined)[] = [];
	return {
		calls,
		pull: async (args) => {
			const index = args?.cursor ?? 0;
			calls.push(args?.cursor);
			return {
				rows: pages[index] ?? [],
				windowStart: "2026-01-01",
				nextCursor: index + 1 < pages.length ? index + 1 : null,
			};
		},
	};
}

async function storedRates(
	db: Database,
): Promise<{ quote: string; date: string }[]> {
	return await db
		.select({ quote: exchangeRates.quote, date: exchangeRates.date })
		.from(exchangeRates)
		.orderBy(exchangeRates.quote);
}

async function lastPullAt(db: Database): Promise<string | null> {
	const rows = await db.select().from(appMeta);
	return rows[0]?.value ?? null;
}

describe("pullRatesIfDue", () => {
	it("holds inside the throttle window without asking the backend", async () => {
		const db = makeDb();
		await db
			.insert(appMeta)
			.values({ key: "lastRatesPullAt", value: String(NOW - 1000) });
		let asked = 0;
		const landed = await pullRatesIfDue(
			db,
			async () => {
				asked += 1;
				return { rows: [], windowStart: "2026-01-01", nextCursor: null };
			},
			{ now: NOW },
		);

		assert.equal(landed, false);
		assert.equal(asked, 0);
	});

	it("pulls once the stamp has aged out", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({
			key: "lastRatesPullAt",
			value: String(NOW - RATES_THROTTLE_MS),
		});
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);

		assert.equal(await pullRatesIfDue(db, pull, { now: NOW }), true);
		assert.deepEqual(await storedRates(db), [
			{ quote: "EUR", date: "2026-07-28" },
		]);
	});

	it("force ignores a stamp that has not aged out", async () => {
		const db = makeDb();
		await db
			.insert(appMeta)
			.values({ key: "lastRatesPullAt", value: String(NOW - 1000) });
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);

		assert.equal(
			await pullRatesIfDue(db, pull, { now: NOW, force: true }),
			true,
		);
		assert.equal((await storedRates(db)).length, 1);
	});

	it("walks every page the cursor offers", async () => {
		const db = makeDb();
		const { pull, calls } = pagedPuller([
			[wireRow("EUR", "2026-07-26")],
			[wireRow("GBP", "2026-07-27")],
			[wireRow("JPY", "2026-07-28")],
		]);

		assert.equal(await pullRatesIfDue(db, pull, { now: NOW }), true);
		assert.deepEqual(calls, [undefined, 1, 2]);
		assert.deepEqual(
			(await storedRates(db)).map((row) => row.quote),
			["EUR", "GBP", "JPY"],
		);
	});

	it("replaces the whole cache rather than merging into it", async () => {
		// A quote the provider dropped must not survive as a rate nothing refreshes.
		const db = makeDb();
		await db.insert(exchangeRates).values(wireRow("VES", "2020-01-01"));
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);

		await pullRatesIfDue(db, pull, { now: NOW });
		assert.deepEqual(await storedRates(db), [
			{ quote: "EUR", date: "2026-07-28" },
		]);
	});

	it("stamps the pull time it was given", async () => {
		const db = makeDb();
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);

		await pullRatesIfDue(db, pull, { now: NOW });
		assert.equal(await lastPullAt(db), String(NOW));
	});

	it("re-stamps over a previous pull rather than conflicting", async () => {
		const db = makeDb();
		await db
			.insert(appMeta)
			.values({ key: "lastRatesPullAt", value: String(NOW - 1) });
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);

		await pullRatesIfDue(db, pull, { now: NOW, force: true });
		assert.equal(await lastPullAt(db), String(NOW));
	});

	it("keeps a stale cache rather than emptying it on an empty snapshot", async () => {
		const db = makeDb();
		await db.insert(exchangeRates).values(wireRow("VES", "2020-01-01"));
		const { pull } = pagedPuller([[]]);

		assert.equal(await pullRatesIfDue(db, pull, { now: NOW }), false);
		assert.equal((await storedRates(db)).length, 1);
		assert.equal(await lastPullAt(db), null);
	});

	it("bumps the rates revision when a pull lands", async () => {
		const db = makeDb();
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);
		const before = ratesRevision();

		await pullRatesIfDue(db, pull, { now: NOW });
		assert.equal(ratesRevision(), before + 1);
	});

	it("leaves the revision alone when throttled", async () => {
		const db = makeDb();
		await db
			.insert(appMeta)
			.values({ key: "lastRatesPullAt", value: String(NOW - 1000) });
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);
		const before = ratesRevision();

		await pullRatesIfDue(db, pull, { now: NOW });
		assert.equal(ratesRevision(), before);
	});

	it("leaves the revision alone when the snapshot is empty", async () => {
		const db = makeDb();
		const { pull } = pagedPuller([[]]);
		const before = ratesRevision();

		await pullRatesIfDue(db, pull, { now: NOW });
		assert.equal(ratesRevision(), before);
	});

	it("rolls the wipe back when the replacement fails part-way", async () => {
		// The wipe and the refill are separate statements. Without a real boundary
		// around them a failed refill leaves the ledger with no rates at all, and
		// every converted total on every screen silently drops to face value until
		// some later pull happens to succeed.
		const db = makeDb();
		await db.insert(exchangeRates).values(wireRow("VES", "2020-01-01"));
		const duplicate = wireRow("EUR", "2026-07-28");
		const { pull } = pagedPuller([[duplicate, duplicate]]);
		const before = ratesRevision();

		await assert.rejects(() => pullRatesIfDue(db, pull, { now: NOW }));
		assert.deepEqual(await storedRates(db), [
			{ quote: "VES", date: "2020-01-01" },
		]);
		// Unstamped, so the next foreground retries rather than waiting out the
		// throttle on a pull that never landed.
		assert.equal(await lastPullAt(db), null);
		assert.equal(ratesRevision(), before);
	});

	it("bumps only once the replaced cache is readable", async () => {
		// Bumping mid-write would invalidate every screen's rate table against a
		// cache that is still half-replaced.
		const db = makeDb();
		await db.insert(exchangeRates).values(wireRow("VES", "2020-01-01"));
		const { pull } = pagedPuller([[wireRow("EUR", "2026-07-28")]]);
		let atBump: { quote: string; date: string }[] = [];
		const unsubscribe = subscribeRatesRevision(() => {
			atBump = db
				.select({ quote: exchangeRates.quote, date: exchangeRates.date })
				.from(exchangeRates)
				.orderBy(exchangeRates.quote)
				.all();
		});

		await pullRatesIfDue(db, pull, { now: NOW });
		unsubscribe();
		assert.deepEqual(atBump, [{ quote: "EUR", date: "2026-07-28" }]);
	});
});
