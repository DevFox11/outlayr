/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { MarketRateType, RateSource } from "./lib/currencies";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type TestClient = TestConvex<typeof schema>;

afterEach(() => {
	vi.useRealTimers();
});

interface SeedRate {
	date: string;
	fetchedAt: number;
	quote: string;
	rate: number;
	rateType: MarketRateType;
	source: RateSource;
}

function seed(t: TestClient, row: SeedRate): Promise<unknown> {
	return t.run((ctx) => ctx.db.insert("exchangeRates", row));
}

function readKey(t: TestClient, quote: string, rateType: MarketRateType, date: string) {
	return t.run((ctx) =>
		ctx.db
			.query("exchangeRates")
			.withIndex("by_quote_and_rateType_and_date", (q) =>
				q.eq("quote", quote).eq("rateType", rateType).eq("date", date)
			)
			.collect()
	);
}

describe("upsertRates", () => {
	test("re-running the same key patches the row in place, never duplicates", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 1000,
			rates: [{ quote: "VES", rate: 40, rateType: "official" }],
			source: "frankfurter",
		});
		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 2000,
			rates: [{ quote: "VES", rate: 41, rateType: "official" }],
			source: "frankfurter",
		});

		const rows = await readKey(t, "VES", "official", "2026-03-13");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			fetchedAt: 2000,
			rate: 41,
			source: "frankfurter",
		});
	});

	test("frankfurter never overwrites a same-key cotizave row", async () => {
		const t = convexTest(schema, modules);
		await seed(t, {
			date: "2026-03-13",
			fetchedAt: 500,
			quote: "VES",
			rate: 38.5,
			rateType: "official",
			source: "cotizave",
		});

		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 1000,
			rates: [{ quote: "VES", rate: 40, rateType: "official" }],
			source: "frankfurter",
		});

		const rows = await readKey(t, "VES", "official", "2026-03-13");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			fetchedAt: 500,
			rate: 38.5,
			source: "cotizave",
		});
	});

	test("cotizave overwrites a same-key frankfurter row", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 500,
			rates: [{ quote: "VES", rate: 40, rateType: "official" }],
			source: "frankfurter",
		});

		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 1000,
			rates: [{ quote: "VES", rate: 38.5, rateType: "official" }],
			source: "cotizave",
		});

		const rows = await readKey(t, "VES", "official", "2026-03-13");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			fetchedAt: 1000,
			rate: 38.5,
			source: "cotizave",
		});
	});

	test("drops non-positive and non-finite rates, upserts the valid subset", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.exchangeRates.upsertRates, {
			date: "2026-03-13",
			fetchedAt: 1000,
			rates: [
				{ quote: "AAA", rate: 0, rateType: "official" },
				{ quote: "BBB", rate: -5, rateType: "official" },
				{ quote: "CCC", rate: Number.POSITIVE_INFINITY, rateType: "official" },
				{ quote: "DDD", rate: Number.NaN, rateType: "official" },
				{ quote: "EUR", rate: 0.92, rateType: "official" },
			],
			source: "frankfurter",
		});

		const all = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ quote: "EUR", rate: 0.92 });
	});
});

describe("getLatestRate", () => {
	test("returns the most-recent-date row", async () => {
		const t = convexTest(schema, modules);
		const seeds: SeedRate[] = [
			{
				date: "2026-03-11",
				fetchedAt: 100,
				quote: "VES",
				rate: 39,
				rateType: "official",
				source: "frankfurter",
			},
			{
				date: "2026-03-13",
				fetchedAt: 300,
				quote: "VES",
				rate: 41,
				rateType: "official",
				source: "frankfurter",
			},
			{
				date: "2026-03-12",
				fetchedAt: 200,
				quote: "VES",
				rate: 40,
				rateType: "official",
				source: "frankfurter",
			},
		];
		for (const row of seeds) {
			await seed(t, row);
		}

		const latest = await t.query(api.exchangeRates.getLatestRate, {
			quote: "VES",
			rateType: "official",
		});
		expect(latest).toEqual({ date: "2026-03-13", fetchedAt: 300, rate: 41 });
	});

	test("returns null when no rate exists for the pair", async () => {
		const t = convexTest(schema, modules);
		await seed(t, {
			date: "2026-03-13",
			fetchedAt: 100,
			quote: "VES",
			rate: 42,
			rateType: "binance",
			source: "cotizave",
		});

		const latest = await t.query(api.exchangeRates.getLatestRate, {
			quote: "VES",
			rateType: "official",
		});
		expect(latest).toBeNull();
	});
});

describe("getRateOnDate", () => {
	const gappedSeeds: SeedRate[] = [
		{
			date: "2026-03-11",
			fetchedAt: 100,
			quote: "VES",
			rate: 38,
			rateType: "official",
			source: "frankfurter",
		},
		{
			date: "2026-03-13",
			fetchedAt: 300,
			quote: "VES",
			rate: 40,
			rateType: "official",
			source: "frankfurter",
		},
	];

	test("returns the exact-date rate when one exists", async () => {
		const t = convexTest(schema, modules);
		for (const row of gappedSeeds) {
			await seed(t, row);
		}

		const result = await t.query(api.exchangeRates.getRateOnDate, {
			date: "2026-03-13",
			quote: "VES",
			rateType: "official",
		});
		expect(result).toEqual({ date: "2026-03-13", fetchedAt: 300, rate: 40 });
	});

	test("falls back to the newest earlier date across a weekend gap", async () => {
		const t = convexTest(schema, modules);
		for (const row of gappedSeeds) {
			await seed(t, row);
		}

		const saturday = await t.query(api.exchangeRates.getRateOnDate, {
			date: "2026-03-14",
			quote: "VES",
			rateType: "official",
		});
		expect(saturday).toEqual({ date: "2026-03-13", fetchedAt: 300, rate: 40 });
	});

	test("returns null when no row is on or before the requested date", async () => {
		const t = convexTest(schema, modules);
		for (const row of gappedSeeds) {
			await seed(t, row);
		}

		const before = await t.query(api.exchangeRates.getRateOnDate, {
			date: "2026-03-01",
			quote: "VES",
			rateType: "official",
		});
		expect(before).toBeNull();
	});
});

const MS_PER_DAY = 86_400_000;

function daysAgoDate(days: number): string {
	return new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);
}

function seedOfficialRate(t: TestClient, quote: string, date: string): Promise<unknown> {
	return seed(t, {
		date,
		fetchedAt: 1000,
		quote,
		rate: 40,
		rateType: "official",
		source: "frankfurter",
	});
}

function allRateDates(t: TestClient, quote: string): Promise<string[]> {
	return t.run(async (ctx) => {
		const rows = await ctx.db
			.query("exchangeRates")
			.withIndex("by_quote_and_rateType_and_date", (q) => q.eq("quote", quote).eq("rateType", "official"))
			.collect();
		return rows.map((row) => row.date).sort();
	});
}

async function runPruneToCompletion(t: TestClient): Promise<void> {
	await t.mutation(internal.exchangeRates.pruneStale, {});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** 250 pre-window dates: forces at least two pages at the 200-row batch size. */
async function seedPreWindowBacklog(t: TestClient, quote: string): Promise<void> {
	for (let days = 91; days <= 340; days += 1) {
		await seedOfficialRate(t, quote, daysAgoDate(days));
	}
}

describe("pruneStale", () => {
	test("keeps one pre-window row per month and every in-window row", async () => {
		// 100 and 120 days back are both in March 2026, so only the newer survives;
		// 200 days back is December 2025 and keeps its own anchor. A single anchor
		// per pair would drop December entirely and leave anything older than the
		// window valuing at face value for good.
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedOfficialRate(t, "VES", daysAgoDate(5));
		await seedOfficialRate(t, "VES", daysAgoDate(100));
		await seedOfficialRate(t, "VES", daysAgoDate(120));
		await seedOfficialRate(t, "VES", daysAgoDate(200));

		await runPruneToCompletion(t);

		expect(await allRateDates(t, "VES")).toEqual([daysAgoDate(200), daysAgoDate(100), daysAgoDate(5)].sort());
	});

	test("collapses several rows in one month down to that month's newest", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedOfficialRate(t, "VES", "2026-01-04");
		await seedOfficialRate(t, "VES", "2026-01-17");
		await seedOfficialRate(t, "VES", "2026-01-29");

		await runPruneToCompletion(t);

		expect(await allRateDates(t, "VES")).toEqual(["2026-01-29"]);
	});

	test("keeps the monthly anchors of non-catalog pairs too", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedOfficialRate(t, "XXX", daysAgoDate(100));
		await seedOfficialRate(t, "XXX", daysAgoDate(200));

		await runPruneToCompletion(t);

		expect(await allRateDates(t, "XXX")).toEqual([daysAgoDate(200), daysAgoDate(100)].sort());
	});

	test("completes across self-scheduled batches when stale rows exceed one batch", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedPreWindowBacklog(t, "VES");

		await runPruneToCompletion(t);

		// 250 consecutive days collapse to one row per calendar month, and the
		// newest survivor is still the row adjacent to the boundary.
		const survivors = await allRateDates(t, "VES");
		expect(survivors).toContain(daysAgoDate(91));
		expect(new Set(survivors.map((date) => date.slice(0, 7))).size).toBe(survivors.length);
		expect(survivors.length).toBeLessThan(12);
	});

	test("a pass started before a clock advance keeps pruning against its original boundary", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		// Captured before the clock moves: daysAgoDate is relative to Date.now().
		const nearBoundaryInWindow = [daysAgoDate(89), daysAgoDate(88)];
		const originalAnchor = daysAgoDate(91);
		await seedOfficialRate(t, "VES", nearBoundaryInWindow[0]);
		await seedOfficialRate(t, "VES", nearBoundaryInWindow[1]);
		await seedPreWindowBacklog(t, "VES");

		const first = await t.mutation(internal.exchangeRates.pruneStale, {});
		expect(first.isDone).toBe(false);
		// Advance past the original boundary before the continuation drains. A
		// per-batch windowStart recompute would now classify the near-boundary
		// rows as pre-window and delete the original pass's anchor.
		vi.setSystemTime(new Date("2026-07-06T12:00:00Z"));
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		// The point is the boundary, not the count: the near-boundary rows must
		// still be classed as in-window, and the original pass's newest pre-window
		// row must survive. A per-batch recompute would have deleted both.
		const survivors = await allRateDates(t, "VES");
		expect(survivors).toContain(originalAnchor);
		for (const date of nearBoundaryInWindow) {
			expect(survivors).toContain(date);
		}
		expect(new Set(survivors.map((date) => date.slice(0, 7))).size).toBe(
			new Set(survivors.filter((date) => date < originalAnchor).map((date) => date.slice(0, 7))).size + 1
		);
	});

	test("a second pass after a completed prune deletes nothing", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedPreWindowBacklog(t, "VES");
		await runPruneToCompletion(t);
		const survivors = await allRateDates(t, "VES");

		const second = await t.mutation(internal.exchangeRates.pruneStale, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		// The post-prune backlog fits one batch, so this pass is a single
		// invocation — `deleted: 0` is the whole pass's total.
		expect(second).toEqual({ deleted: 0, isDone: true });
		expect(await allRateDates(t, "VES")).toEqual(survivors);
	});

	test("pullRates still serves the anchor after GC", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
		const t = convexTest(schema, modules);
		await seedOfficialRate(t, "VES", daysAgoDate(10));
		await seedOfficialRate(t, "VES", daysAgoDate(100));
		await seedOfficialRate(t, "VES", daysAgoDate(200));

		await runPruneToCompletion(t);
		// Unauthenticated on purpose: `pullRates` is public.
		const result = await t.query(api.exchangeRates.pullRates, {});

		const dates = result.rows.filter((r) => r.quote === "VES").map((r) => r.date);
		// All three: the in-window row plus both monthly anchors. Serving only the
		// newest anchor is what left anything older than it on face value.
		expect(dates).toHaveLength(3);
		expect(dates).toContain(daysAgoDate(10));
		expect(dates).toContain(daysAgoDate(100));
		expect(dates).toContain(daysAgoDate(200));
	});
});
