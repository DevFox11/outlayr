import { describe, expect, it } from "vitest";
import {
	COMPUTE_USD_THROW_VECTORS,
	COMPUTE_USD_VECTORS,
	makeRateLookup,
	RATES_WINDOW_DAYS,
	REFERENCE_DATE_MS,
	ROUND_MONEY_VECTORS,
} from "./fixtures";
import {
	CURRENCY_DECIMALS,
	computeAmountUSD,
	convertFromUsd,
	currencyDisplayFor,
	isPickableCurrency,
	MoneyValidationError,
	PICKABLE_CURRENCY_CODES,
	roundMoney,
} from "./index";

const WINDOW_MS = RATES_WINDOW_DAYS * 86_400_000;

describe("golden vectors — computeAmountUSD", () => {
	for (const vector of COMPUTE_USD_VECTORS) {
		it(vector.name, async () => {
			const lookup = makeRateLookup(vector.rateTable);
			await expect(computeAmountUSD(lookup, vector.input)).resolves.toBe(
				vector.expectedUSD,
			);
		});
	}

	for (const vector of COMPUTE_USD_THROW_VECTORS) {
		it(`rejects: ${vector.name}`, async () => {
			const lookup = makeRateLookup(vector.rateTable);
			await expect(computeAmountUSD(lookup, vector.input)).rejects.toThrow(
				MoneyValidationError,
			);
			await expect(computeAmountUSD(lookup, vector.input)).rejects.toThrow(
				vector.messagePattern,
			);
		});
	}
});

describe("golden vectors — roundMoney half-even", () => {
	for (const vector of ROUND_MONEY_VECTORS) {
		it(vector.name, () => {
			expect(roundMoney(vector.value, vector.decimals)).toBe(vector.expected);
		});
	}
});

describe("golden vectors — determinism guards", () => {
	it("keeps every rate-table date inside the snapshot window", () => {
		const dates = COMPUTE_USD_VECTORS.flatMap((vector) =>
			vector.rateTable.map((row) => Date.parse(row.date)),
		);
		expect(dates.length).toBeGreaterThan(0);
		for (const date of dates) {
			expect(REFERENCE_DATE_MS - date).toBeGreaterThanOrEqual(0);
			expect(REFERENCE_DATE_MS - date).toBeLessThanOrEqual(WINDOW_MS);
		}
	});
});

interface ConvertVector {
	amountUsd: number;
	code: string;
	expected: number;
	name: string;
	rate: number;
}

const CONVERT_FROM_USD_VECTORS: ConvertVector[] = [
	{
		name: "EUR two-decimal half-even (100 @ 0.87428 -> 87.43)",
		amountUsd: 100,
		rate: 0.874_28,
		code: "EUR",
		expected: 87.43,
	},
	{
		name: "JPY zero-decimal (100 @ 148.52 -> 14852)",
		amountUsd: 100,
		rate: 148.52,
		code: "JPY",
		expected: 14_852,
	},
	{
		name: "KWD three-decimal dinar (100 @ 0.30749 -> 30.749)",
		amountUsd: 100,
		rate: 0.307_49,
		code: "KWD",
		expected: 30.749,
	},
	{
		name: "USD identity keeps sub-cent precision exactly (rate 1)",
		amountUsd: 87.428,
		rate: 1,
		code: "USD",
		expected: 87.428,
	},
	{
		name: "USD identity on a whole balance (rate 1)",
		amountUsd: 12_480,
		rate: 1,
		code: "USD",
		expected: 12_480,
	},
	{
		name: "half-even tie rounds down to even (0.125 -> 0.12)",
		amountUsd: 1,
		rate: 0.125,
		code: "EUR",
		expected: 0.12,
	},
	{
		name: "half-even tie rounds up to even (0.375 -> 0.38)",
		amountUsd: 3,
		rate: 0.125,
		code: "EUR",
		expected: 0.38,
	},
	{
		name: "negative amount keeps its sign through half-even rounding",
		amountUsd: -100,
		rate: 0.874_28,
		code: "EUR",
		expected: -87.43,
	},
];

describe("golden vectors — convertFromUsd", () => {
	for (const vector of CONVERT_FROM_USD_VECTORS) {
		it(vector.name, () => {
			expect(convertFromUsd(vector.amountUsd, vector.rate, vector.code)).toBe(
				vector.expected,
			);
		});
	}

	it("rejects a non-finite amount before applying the identity shortcut", () => {
		expect(() => convertFromUsd(Number.POSITIVE_INFINITY, 1, "USD")).toThrow(
			MoneyValidationError,
		);
	});

	it("rejects a non-finite rate", () => {
		expect(() => convertFromUsd(100, Number.NaN, "EUR")).toThrow(
			MoneyValidationError,
		);
	});
});

describe("CURRENCY_DECIMALS", () => {
	it("assigns zero fractional digits to JPY, KRW, and ISK", () => {
		expect(CURRENCY_DECIMALS.JPY).toBe(0);
		expect(CURRENCY_DECIMALS.KRW).toBe(0);
		expect(CURRENCY_DECIMALS.ISK).toBe(0);
	});

	it("assigns two fractional digits to standard currencies", () => {
		expect(CURRENCY_DECIMALS.USD).toBe(2);
		expect(CURRENCY_DECIMALS.EUR).toBe(2);
	});

	it("assigns three fractional digits to dinar-style currencies", () => {
		expect(CURRENCY_DECIMALS.KWD).toBe(3);
		expect(CURRENCY_DECIMALS.BHD).toBe(3);
	});

	it("covers every pickable currency code exactly once", () => {
		for (const code of PICKABLE_CURRENCY_CODES) {
			expect(CURRENCY_DECIMALS[code]).toBeDefined();
		}
		expect(Object.keys(CURRENCY_DECIMALS)).toHaveLength(
			PICKABLE_CURRENCY_CODES.length,
		);
	});
});

describe("currencyDisplayFor", () => {
	it("returns generated metadata for a catalog code", () => {
		expect(currencyDisplayFor("VES")).toEqual({
			name: "Venezuelan Bolívar",
			symbol: "Bs.",
		});
	});

	it("falls back to the bare code for a code absent from the catalog", () => {
		expect(currencyDisplayFor("ZZZ")).toEqual({ name: "ZZZ", symbol: "ZZZ" });
	});
});

describe("provider-driven catalog coverage", () => {
	it("covers the full provider blend, USD first, with CNH present", () => {
		expect(PICKABLE_CURRENCY_CODES.length).toBeGreaterThanOrEqual(165);
		expect(PICKABLE_CURRENCY_CODES[0]).toBe("USD");
		expect(PICKABLE_CURRENCY_CODES).toContain("CNH");
	});

	it("makes VES and metals pickable and drops BGN", () => {
		expect(isPickableCurrency("VES")).toBe(true);
		expect(isPickableCurrency("XAU")).toBe(true);
		expect(isPickableCurrency("BGN")).toBe(false);
	});
});
