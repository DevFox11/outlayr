/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const COTIZAVE_URL = "https://api.cotizave.com/v1/fx/rates";
const MISSING_KEY_PATTERN = /COTIZAVE_API_KEY/;

function liveRatesPayload() {
	return {
		base: "USD",
		country: "VE",
		currency: "VES",
		fetched_at: "2026-07-03T18:22:36Z",
		rates: [
			{ market: "reference", mid: 652.9726, type: "reference" },
			{ market: "eur_reference", mid: 747.327_140_7, type: "reference" },
			{ market: "parallel", mid: 736.979_75, type: "parallel" },
			{ ask: 737.9, bid: 739.2, market: "binance", mid: 738.55, type: "p2p" },
			{ market: "bybit", mid: 737.475, type: "p2p" },
		],
	};
}

function stubFetch(payload: unknown, ok = true) {
	const response = {
		json: () => Promise.resolve(payload),
		ok,
		status: ok ? 200 : 500,
	};
	const fetchMock = vi.fn((_input: string, _init?: RequestInit) => Promise.resolve(response));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("cotizave.fetchRates", () => {
	test("stores three VES rows from reference/eur_reference/binance mids", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-03T18:22:36Z"));
		const t = convexTest(schema, modules);
		stubFetch(liveRatesPayload());

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(3);
		const official = rows.find((row) => row.rateType === "official");
		const eur = rows.find((row) => row.rateType === "eur_reference");
		const binance = rows.find((row) => row.rateType === "binance");
		expect(official).toMatchObject({
			date: "2026-07-03",
			quote: "VES",
			rate: 652.9726,
			source: "cotizave",
		});
		expect(eur).toMatchObject({
			quote: "VES",
			rate: 747.327_140_7,
			source: "cotizave",
		});
		expect(binance).toMatchObject({
			quote: "VES",
			rate: 738.55,
			source: "cotizave",
		});
	});

	test("cotizave reference overrides an existing frankfurter VES official row", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-03T18:00:00Z"));
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				date: "2026-07-03",
				fetchedAt: 1,
				quote: "VES",
				rate: 40,
				rateType: "official",
				source: "frankfurter",
			})
		);
		stubFetch(liveRatesPayload());

		await t.action(internal.cotizave.fetchRates, {});

		const official = await t.run((ctx) =>
			ctx.db
				.query("exchangeRates")
				.withIndex("by_quote_and_rateType_and_date", (q) =>
					q.eq("quote", "VES").eq("rateType", "official").eq("date", "2026-07-03")
				)
				.unique()
		);
		expect(official).toMatchObject({ rate: 652.9726, source: "cotizave" });
	});

	test("upserts valid markets and leaves an invalid market's prior row intact", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-07-03T18:00:00Z"));
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				date: "2026-07-03",
				fetchedAt: 1,
				quote: "VES",
				rate: 700,
				rateType: "eur_reference",
				source: "cotizave",
			})
		);
		const payload = liveRatesPayload();
		payload.rates[1] = { market: "eur_reference", mid: 0, type: "reference" };
		stubFetch(payload);

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		const byType = new Map(rows.map((row) => [row.rateType, row]));
		expect(byType.get("official")).toMatchObject({
			rate: 652.9726,
			source: "cotizave",
		});
		expect(byType.get("binance")).toMatchObject({
			rate: 738.55,
			source: "cotizave",
		});
		expect(byType.get("eur_reference")).toMatchObject({
			fetchedAt: 1,
			rate: 700,
		});
	});

	test("writes nothing and logs an error for a fully malformed response", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				date: "2026-07-03",
				fetchedAt: 1,
				quote: "VES",
				rate: 650,
				rateType: "official",
				source: "cotizave",
			})
		);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		stubFetch({ error: "boom" });

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ rate: 650, source: "cotizave" });
		expect(errorSpy).toHaveBeenCalled();
	});

	test("writes nothing and logs an error when no target market is present", async () => {
		const t = convexTest(schema, modules);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		stubFetch({
			base: "USD",
			currency: "VES",
			rates: [
				{ market: "parallel", mid: 736.97, type: "parallel" },
				{ market: "bybit", mid: 737.47, type: "p2p" },
			],
		});

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(0);
		expect(errorSpy).toHaveBeenCalled();
	});

	test("writes nothing and keeps prior rows when the response currency is not VES", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				date: "2026-07-03",
				fetchedAt: 1,
				quote: "VES",
				rate: 650,
				rateType: "official",
				source: "cotizave",
			})
		);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		const payload = liveRatesPayload();
		stubFetch({ ...payload, currency: "COP" });

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ fetchedAt: 1, rate: 650 });
		expect(errorSpy).toHaveBeenCalled();
	});

	test("writes nothing and keeps prior rows when the response base is not USD", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("exchangeRates", {
				date: "2026-07-03",
				fetchedAt: 1,
				quote: "VES",
				rate: 650,
				rateType: "official",
				source: "cotizave",
			})
		);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// silence expected error log
		});
		const payload = liveRatesPayload();
		stubFetch({ ...payload, base: "EUR" });

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ fetchedAt: 1, rate: 650 });
		expect(errorSpy).toHaveBeenCalled();
	});

	test("throws a descriptive error when COTIZAVE_API_KEY is missing", async () => {
		vi.stubEnv("COTIZAVE_API_KEY", "");
		const t = convexTest(schema, modules);
		const fetchMock = stubFetch(liveRatesPayload());

		await expect(t.action(internal.cotizave.fetchRates, {})).rejects.toThrow(MISSING_KEY_PATTERN);

		expect(fetchMock).not.toHaveBeenCalled();
		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows).toHaveLength(0);
	});

	test("authenticates with the X-API-Key header", async () => {
		const t = convexTest(schema, modules);
		const fetchMock = stubFetch(liveRatesPayload());

		await t.action(internal.cotizave.fetchRates, {});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const firstCall = fetchMock.mock.calls[0];
		if (!firstCall) {
			throw new Error("Expected fetch to have been called once");
		}
		const [url, init] = firstCall;
		expect(url).toBe(COTIZAVE_URL);
		expect(init?.headers).toMatchObject({ "X-API-Key": "test-cotizave-key" });
	});

	test("pins the row date to the UTC fetch day, ignoring local offset", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		// 2026-01-01 20:00 at UTC-5 is 2026-01-02 01:00 UTC.
		vi.setSystemTime(new Date("2026-01-01T20:00:00-05:00"));
		const t = convexTest(schema, modules);
		stubFetch(liveRatesPayload());

		await t.action(internal.cotizave.fetchRates, {});

		const rows = await t.run((ctx) => ctx.db.query("exchangeRates").collect());
		expect(rows.every((row) => row.date === "2026-01-02")).toBe(true);
	});
});
