/// <reference types="vite/client" />

import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "../schema";
import {
	computeAmountUSD,
	entryRateType,
	isPickableCurrency,
	type MarketRateType,
	METAL_CURRENCY_CODES,
	marketRateType,
	PICKABLE_CURRENCY_CODES,
	resolveEntryRate,
	roundMoney,
	utcDateString,
} from "./currencies";

const modules = import.meta.glob("../**/*.ts");

function seedExchangeRate(
	t: TestConvex<typeof schema>,
	row: { quote: string; rateType: MarketRateType; rate: number; date: string },
): Promise<unknown> {
	return t.run((ctx) =>
		ctx.db.insert("exchangeRates", {
			quote: row.quote,
			rateType: row.rateType,
			rate: row.rate,
			date: row.date,
			source: "frankfurter",
			fetchedAt: 1000,
		}),
	);
}

describe("roundMoney (banker's rounding, half-even)", () => {
	test("rounds a halfway value down to the even neighbor", () => {
		expect(roundMoney(2.5, 0)).toBe(2);
		expect(roundMoney(0.125, 2)).toBe(0.12);
	});

	test("rounds a halfway value up to the even neighbor", () => {
		expect(roundMoney(3.5, 0)).toBe(4);
		expect(roundMoney(0.375, 2)).toBe(0.38);
		expect(roundMoney(0.135, 2)).toBe(0.14);
	});

	test("applies half-even to negative halfway values", () => {
		expect(roundMoney(-2.5, 0)).toBe(-2);
		expect(roundMoney(-0.125, 2)).toBe(-0.12);
	});

	test("rounds non-halfway values to the nearest cent", () => {
		expect(roundMoney(1.014, 2)).toBe(1.01);
		expect(roundMoney(1.016, 2)).toBe(1.02);
	});

	test("defaults to two decimals and is identity on whole values", () => {
		expect(roundMoney(10)).toBe(10);
		expect(roundMoney(10.006)).toBe(10.01);
	});

	test("rounds once after full-precision summation (aggregate rule)", () => {
		const unrounded = [10.125, 20.125, 30.125];
		const sum = unrounded.reduce((total, value) => total + value, 0);
		expect(roundMoney(sum, 2)).toBe(60.38);
		const roundEachFirst = unrounded
			.map((value) => roundMoney(value, 2))
			.reduce((total, value) => total + value, 0);
		expect(roundMoney(roundEachFirst, 2)).toBe(60.36);
	});
});

describe("utcDateString", () => {
	test("formats an epoch as a UTC YYYY-MM-DD string", () => {
		expect(utcDateString(Date.UTC(2026, 2, 15, 12, 0, 0))).toBe("2026-03-15");
	});

	test("stays on the same UTC day just before UTC midnight", () => {
		expect(utcDateString(Date.UTC(2026, 2, 15, 23, 59, 59))).toBe("2026-03-15");
	});

	test("advances to the next UTC day at UTC midnight", () => {
		expect(utcDateString(Date.UTC(2026, 2, 16, 0, 0, 0))).toBe("2026-03-16");
	});

	test("pins to the UTC day regardless of the local offset", () => {
		const lateLocalEvening = new Date("2026-01-01T20:00:00-05:00").getTime();
		expect(utcDateString(lateLocalEvening)).toBe("2026-01-02");
	});
});

describe("isPickableCurrency (default-currency allowlist)", () => {
	test("accepts USD, VES, and common fiat quotes", () => {
		expect(isPickableCurrency("USD")).toBe(true);
		expect(isPickableCurrency("VES")).toBe(true);
		expect(isPickableCurrency("EUR")).toBe(true);
	});

	test("accepts precious-metal quotes as pickable currencies (Decision #707)", () => {
		expect(isPickableCurrency("XAU")).toBe(true);
		expect(isPickableCurrency("XAG")).toBe(true);
	});

	test("rejects unknown, malformed, or dropped codes", () => {
		expect(isPickableCurrency("XXX")).toBe(false);
		expect(isPickableCurrency("usd")).toBe(false);
		expect(isPickableCurrency("BGN")).toBe(false);
		expect(isPickableCurrency("")).toBe(false);
	});

	test("the pickable catalog now includes every metal code", () => {
		const pickable = new Set<string>(PICKABLE_CURRENCY_CODES);
		const included = METAL_CURRENCY_CODES.filter((code) => pickable.has(code));
		expect(included).toEqual([...METAL_CURRENCY_CODES]);
	});
});

describe("resolveEntryRate", () => {
	test("returns the customRate verbatim for a custom rate type", async () => {
		const t = convexTest(schema, modules);
		const rate = await t.run((ctx) =>
			resolveEntryRate(ctx.db, "VES", "custom", 80, "2020-01-01"),
		);
		expect(rate).toBe(80);
	});

	test("throws when a custom rate type has no customRate", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				resolveEntryRate(ctx.db, "VES", "custom", undefined, "2020-01-01"),
			),
		).rejects.toThrow(ConvexError);
	});

	test("throws when customRate is not a positive number", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				resolveEntryRate(ctx.db, "VES", "custom", 0, "2020-01-01"),
			),
		).rejects.toThrow(ConvexError);
	});

	test("rejects a customRate supplied with a market rate type", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				resolveEntryRate(ctx.db, "VES", "official", 50, "2020-01-01"),
			),
		).rejects.toThrow(ConvexError);
	});

	test("rejects eur_reference for a non-VES currency", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				resolveEntryRate(
					ctx.db,
					"EUR",
					"eur_reference",
					undefined,
					"2020-01-01",
				),
			),
		).rejects.toThrow(ConvexError);
	});

	test("resolves the market rate effective on the date", async () => {
		const t = convexTest(schema, modules);
		await seedExchangeRate(t, {
			quote: "VES",
			rateType: "official",
			rate: 40,
			date: "2020-01-01",
		});

		const rate = await t.run((ctx) =>
			resolveEntryRate(ctx.db, "VES", "official", undefined, "2020-06-01"),
		);
		expect(rate).toBe(40);
	});

	test("throws when no market rate is available on the date", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				resolveEntryRate(ctx.db, "VES", "official", undefined, "2020-01-01"),
			),
		).rejects.toThrow(ConvexError);
	});
});

describe("computeAmountUSD", () => {
	test("divides the base amount by the rate for a single-leg market type", async () => {
		const t = convexTest(schema, modules);
		const usd = await t.run((ctx) =>
			computeAmountUSD(ctx.db, {
				baseAmount: 4000,
				exchangeRateType: "official",
				exchangeRate: 40,
				date: "2020-01-01",
			}),
		);
		expect(usd).toBe(100);
	});

	test("divides the base amount by the rate for a custom type", async () => {
		const t = convexTest(schema, modules);
		const usd = await t.run((ctx) =>
			computeAmountUSD(ctx.db, {
				baseAmount: 5000,
				exchangeRateType: "custom",
				exchangeRate: 50,
				date: "2020-01-01",
			}),
		);
		expect(usd).toBe(100);
	});

	test("applies the two-leg EUR conversion for eur_reference (worked example)", async () => {
		const t = convexTest(schema, modules);
		await seedExchangeRate(t, {
			quote: "EUR",
			rateType: "official",
			rate: 0.874_28,
			date: "2020-01-01",
		});

		const usd = await t.run((ctx) =>
			computeAmountUSD(ctx.db, {
				baseAmount: 74_733,
				exchangeRateType: "eur_reference",
				exchangeRate: 747.33,
				date: "2020-06-15",
			}),
		);
		expect(usd).toBe(114.379_833);
	});

	test("throws a descriptive error when the EUR leg is missing", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.run((ctx) =>
				computeAmountUSD(ctx.db, {
					baseAmount: 74_733,
					exchangeRateType: "eur_reference",
					exchangeRate: 747.33,
					date: "2020-01-01",
				}),
			),
		).rejects.toThrow(ConvexError);
	});
});

describe("rate-type enum split (Decision 10)", () => {
	test("marketRateType keeps binance for the rate table and excludes custom", () => {
		const values = marketRateType.members.map((member) => member.value);
		expect(values).toContain("official");
		expect(values).toContain("eur_reference");
		expect(values).toContain("binance");
		expect(values).not.toContain("custom");
	});

	test("entryRateType drops binance for records and adds custom", () => {
		const values = entryRateType.members.map((member) => member.value);
		expect(values).toContain("official");
		expect(values).toContain("eur_reference");
		expect(values).toContain("custom");
		expect(values).not.toContain("binance");
	});
});
