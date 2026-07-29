/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function stubFetch(payload: unknown, ok = true): void {
	const response = {
		ok,
		status: ok ? 200 : 500,
		json: () => Promise.resolve(payload),
	};
	vi.stubGlobal(
		"fetch",
		vi.fn(() => Promise.resolve(response)),
	);
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("frankfurter.fetchRates", () => {
	test("stores one official row per valid record with source frankfurter", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-03-13T10:00:00Z"));
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-03-13", base: "USD", quote: "VES", rate: 40 },
			{ date: "2026-03-13", base: "USD", quote: "EUR", rate: 0.92 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(2);
		const ves = rows.find((row) => row.quote === "VES");
		const eur = rows.find((row) => row.quote === "EUR");
		expect(ves).toMatchObject({
			rate: 40,
			rateType: "official",
			source: "frankfurter",
			date: "2026-03-13",
		});
		expect(eur).toMatchObject({
			rate: 0.92,
			rateType: "official",
			source: "frankfurter",
		});
	});

	test("upserts only the valid subset and leaves unrelated rows intact", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "ARS",
				rateType: "official",
				source: "cotizave",
				rate: 1300,
				date: "2026-03-13",
				fetchedAt: 1,
			}),
		);
		stubFetch([
			{ date: "2026-03-13", base: "USD", quote: "VES", rate: 40 },
			{ date: "2026-03-13", base: "USD", quote: "BAD", rate: 0 },
			{ date: "2026-03-13", base: "EUR", quote: "GBP", rate: 0.8 },
			{ quote: "JPY", rate: 150 },
			{ date: "2026-03-13", base: "USD", quote: "CHF", rate: 0.88 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		const quotes = rows.map((row) => row.quote).sort();
		expect(quotes).toEqual(["ARS", "CHF", "VES"]);
		const ars = rows.find((row) => row.quote === "ARS");
		expect(ars).toMatchObject({ rate: 1300, source: "cotizave", fetchedAt: 1 });
	});

	test("ingests every shape-valid quote with no allowlist, dropping only malformed codes", async () => {
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-03-13", base: "USD", quote: "XAU", rate: 0.0005 },
			{ date: "2026-03-13", base: "USD", quote: "ZZZ", rate: 12 },
			{ date: "2026-03-13", base: "USD", quote: "VES", rate: 40 },
			{ date: "2026-03-13", base: "USD", quote: "eur", rate: 0.9 },
			{ date: "2026-03-13", base: "USD", quote: "US", rate: 1 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		const quotes = rows.map((row) => row.quote).sort();
		expect(quotes).toEqual(["VES", "XAU", "ZZZ"]);
	});

	test("writes nothing and logs an error for a non-array response", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "VES",
				rateType: "official",
				source: "cotizave",
				rate: 38,
				date: "2026-03-13",
				fetchedAt: 1,
			}),
		);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		stubFetch({ error: "boom" });

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ rate: 38, source: "cotizave" });
		expect(errorSpy).toHaveBeenCalled();
	});

	test("writes nothing and logs an error for an empty array", async () => {
		const t = convexTest(schema, modules);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		stubFetch([]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(0);
		expect(errorSpy).toHaveBeenCalled();
	});

	test("writes nothing and logs an error when the request rejects", async () => {
		const t = convexTest(schema, modules);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("network down"))),
		);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(0);
		expect(errorSpy).toHaveBeenCalled();
	});

	test("keys each row by the record's own date, not the UTC fetch day", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		// 2026-01-01 20:00 at UTC-5 is 2026-01-02 01:00 UTC — the fetch day is
		// 2026-01-02, but the record's effective date 2026-01-01 must win.
		vi.setSystemTime(new Date("2026-01-01T20:00:00-05:00"));
		const t = convexTest(schema, modules);
		stubFetch([{ date: "2026-01-01", base: "USD", quote: "VES", rate: 40 }]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ date: "2026-01-01" });
	});

	test("stores a mixed-dates batch as separate per-date rows", async () => {
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-03-13", base: "USD", quote: "VES", rate: 40 },
			{ date: "2026-03-12", base: "USD", quote: "EUR", rate: 0.92 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.quote === "VES")).toMatchObject({
			date: "2026-03-13",
			rate: 40,
		});
		expect(rows.find((row) => row.quote === "EUR")).toMatchObject({
			date: "2026-03-12",
			rate: 0.92,
		});
	});

	test("drops records with invalid dates and keeps the valid subset", async () => {
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-03-13", base: "USD", quote: "VES", rate: 40 },
			{ date: "13-03-2026", base: "USD", quote: "EUR", rate: 0.92 },
			{ base: "USD", quote: "GBP", rate: 0.8 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ quote: "VES", date: "2026-03-13" });
	});
});

describe("frankfurter.fetchRates window", () => {
	test("asks for the whole window, not just today", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		stubFetch([{ date: "2026-07-29", base: "USD", quote: "EUR", rate: 0.9 }]);

		await t.action(internal.frankfurter.fetchRates, {});

		// 90 days back from 2026-07-29.
		const url = vi.mocked(fetch).mock.calls[0]?.[0];
		expect(url).toBe(
			"https://api.frankfurter.dev/v2/rates?base=USD&from=2026-04-30",
		);
	});

	test("stores every day the window returns", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-05-04", base: "USD", quote: "EUR", rate: 0.88 },
			{ date: "2026-06-15", base: "USD", quote: "EUR", rate: 0.89 },
			{ date: "2026-07-29", base: "USD", quote: "EUR", rate: 0.9 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows.map((row) => row.date).sort()).toEqual([
			"2026-05-04",
			"2026-06-15",
			"2026-07-29",
		]);
	});

	test("leaves a settled day alone rather than rewriting it", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "EUR",
				rateType: "official",
				source: "frankfurter",
				rate: 0.88,
				date: "2026-05-04",
				fetchedAt: 1,
			}),
		);
		// The provider now reports a different figure for that settled day: it is
		// outside the refresh margin and already held, so it is not rewritten.
		stubFetch([{ date: "2026-05-04", base: "USD", quote: "EUR", rate: 0.99 }]);

		await t.action(internal.frankfurter.fetchRates, {});

		const [row] = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(row).toMatchObject({ rate: 0.88, fetchedAt: 1 });
	});

	test("rewrites a held day inside the refresh margin", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "EUR",
				rateType: "official",
				source: "frankfurter",
				rate: 0.88,
				date: "2026-07-27",
				fetchedAt: 1,
			}),
		);
		// A recent day arrives incomplete and fills in later, so holding EUR for it
		// is no proof the other 164 quotes landed.
		stubFetch([
			{ date: "2026-07-27", base: "USD", quote: "EUR", rate: 0.99 },
			{ date: "2026-07-27", base: "USD", quote: "JPY", rate: 157 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.quote === "EUR")).toMatchObject({
			rate: 0.99,
		});
	});

	test("rewrites a complete day inside the refresh margin so revisions land", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "EUR",
				rateType: "official",
				source: "frankfurter",
				rate: 0.88,
				date: "2026-07-27",
				fetchedAt: 1,
			}),
		);
		stubFetch([{ date: "2026-07-27", base: "USD", quote: "EUR", rate: 0.99 }]);

		await t.action(internal.frankfurter.fetchRates, {});

		const [row] = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(row).toMatchObject({ rate: 0.99 });
	});
});

describe("frankfurter.fetchRates coverage", () => {
	test("re-fills an aged day the feed has since filled in", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		// Inside the 90-day window, far outside the 7-day refresh margin, and held
		// with only one of the two quotes the feed now publishes for it.
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				quote: "EUR",
				rateType: "official",
				source: "frankfurter",
				rate: 0.88,
				date: "2026-06-15",
				fetchedAt: 1,
			}),
		);
		stubFetch([
			{ date: "2026-06-15", base: "USD", quote: "EUR", rate: 0.88 },
			{ date: "2026-06-15", base: "USD", quote: "JPY", rate: 157 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows.map((row) => row.quote).sort()).toEqual(["EUR", "JPY"]);
	});

	test("does not read a non-official row as coverage for the official quote", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		for (const row of [
			{ quote: "EUR", rateType: "official" as const, rate: 0.88 },
			{ quote: "VES", rateType: "binance" as const, rate: 45 },
		]) {
			await t.run((ctx) =>
				ctx.db.insert("exchangeRates", {
					...row,
					source: "frankfurter",
					date: "2026-06-15",
					fetchedAt: 1,
				}),
			);
		}
		stubFetch([
			{ date: "2026-06-15", base: "USD", quote: "EUR", rate: 0.88 },
			{ date: "2026-06-15", base: "USD", quote: "VES", rate: 40 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		const official = rows.filter((row) => row.rateType === "official");
		expect(official.map((row) => row.quote).sort()).toEqual(["EUR", "VES"]);
	});

	test("writes a day the feed never fills once, then stops retrying it", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		stubFetch([{ date: "2026-06-15", base: "USD", quote: "EUR", rate: 0.88 }]);

		await t.action(internal.frankfurter.fetchRates, {});
		const [first] = await t.run((ctx) =>
			ctx.db.query("exchangeRates").collect(),
		);
		vi.setSystemTime(new Date("2026-07-29T22:00:00Z"));
		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]?.fetchedAt).toBe(first?.fetchedAt);
	});

	test("re-fills an aged day held with no rows at all", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-29T10:00:00Z"));
		const t = convexTest(schema, modules);
		stubFetch([
			{ date: "2026-06-15", base: "USD", quote: "EUR", rate: 0.88 },
			{ date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.89 },
		]);

		await t.action(internal.frankfurter.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows.map((row) => row.date).sort()).toEqual([
			"2026-06-15",
			"2026-06-16",
		]);
	});
});
