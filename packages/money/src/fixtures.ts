import type { EntryRateType, MarketRateType, RateLookup } from "./index";

/**
 * Golden vectors shared by the `@outlayr/money` vitest suite AND the
 * `apps/native` jest suite; running both proves V8<->V8 parity only (Hermes
 * parity is verified separately by an on-device e2e run). Dates derive from a
 * fixed reference instant, never `Date.now()`.
 */

const DATE_STRING_LENGTH = 10;
const DAY_MS = 86_400_000;

/** Fixed reference instant: 2026-06-30, UTC. */
export const REFERENCE_DATE_MS = Date.UTC(2026, 5, 30);

/** Backend rate-snapshot window; every vector date stays inside it. */
export const RATES_WINDOW_DAYS = 90;

export function dateWithinWindow(daysBeforeReference: number): string {
	return new Date(REFERENCE_DATE_MS - daysBeforeReference * DAY_MS).toISOString().slice(0, DATE_STRING_LENGTH);
}

export interface RateTableRow {
	date: string;
	quote: string;
	rate: number;
	rateType: MarketRateType;
}

/**
 * Mirrors the backend `resolveRateOnDate` contract: the newest row whose `date`
 * is on or before the requested date wins (covers weekend/holiday gaps), else
 * `null`.
 */
export function makeRateLookup(rows: readonly RateTableRow[]): RateLookup {
	return (quote, rateType, date) => {
		// `localeCompare` is a TOTAL order over the `YYYY-MM-DD` strings (returns 0
		// on equal dates), so the sort stays deterministic even if a table ever
		// carries duplicate (quote, rateType, date) rows.
		const match = rows
			.filter((r) => r.quote === quote && r.rateType === rateType && r.date <= date)
			.sort((a, b) => b.date.localeCompare(a.date))[0];
		return Promise.resolve(match ? { date: match.date, rate: match.rate } : null);
	};
}

export interface ComputeUsdVector {
	expectedUSD: number;
	input: {
		baseAmount: number;
		exchangeRateType: EntryRateType;
		exchangeRate: number;
		date: string;
	};
	name: string;
	rateTable: RateTableRow[];
}

const ENTRY_DATE = dateWithinWindow(0);
const EUR_GAP_DATE = dateWithinWindow(45);

/** Vectors whose result is a finite canonical USD amount at micro-dollar scale. */
export const COMPUTE_USD_VECTORS: ComputeUsdVector[] = [
	{
		expectedUSD: 80,
		input: {
			baseAmount: 4000,
			date: ENTRY_DATE,
			exchangeRate: 50,
			exchangeRateType: "official",
		},
		name: "single-leg official, exact quotient",
		rateTable: [],
	},
	{
		expectedUSD: 33.333_333,
		input: {
			baseAmount: 100,
			date: ENTRY_DATE,
			exchangeRate: 3,
			exchangeRateType: "official",
		},
		name: "single-leg official, repeating quotient rounds half-even at scale 6",
		rateTable: [],
	},
	{
		expectedUSD: 2.5,
		input: {
			baseAmount: 100,
			date: ENTRY_DATE,
			exchangeRate: 40,
			exchangeRateType: "custom",
		},
		name: "single-leg custom rate",
		rateTable: [],
	},
	{
		expectedUSD: 114.379_833,
		input: {
			baseAmount: 74_733,
			date: ENTRY_DATE,
			exchangeRate: 747.33,
			exchangeRateType: "eur_reference",
		},
		name: "eur_reference two-leg, EUR official on the entry date",
		rateTable: [{ date: ENTRY_DATE, quote: "EUR", rate: 0.874_28, rateType: "official" }],
	},
	{
		expectedUSD: 103.795_833,
		input: {
			baseAmount: 74_733,
			date: ENTRY_DATE,
			exchangeRate: 800,
			exchangeRateType: "eur_reference",
		},
		name: "eur_reference two-leg resolves the newest EUR row across a weekend gap",
		rateTable: [{ date: EUR_GAP_DATE, quote: "EUR", rate: 0.9, rateType: "official" }],
	},
	{
		expectedUSD: -33.333_333,
		input: {
			baseAmount: -100,
			date: ENTRY_DATE,
			exchangeRate: 3,
			exchangeRateType: "official",
		},
		name: "negative base amount keeps its sign through half-even division",
		rateTable: [],
	},
	{
		expectedUSD: 9_000_000_000,
		input: {
			baseAmount: 9_000_000_000,
			date: ENTRY_DATE,
			exchangeRate: 1,
			exchangeRateType: "official",
		},
		name: "large amount stays exact just under the 2^53 micro-dollar ceiling",
		// 9e9 USD = 9e15 micro-dollars < Number.MAX_SAFE_INTEGER (~9.007e15).
		rateTable: [],
	},
];

export interface ComputeUsdThrowVector {
	input: {
		baseAmount: number;
		exchangeRateType: EntryRateType;
		exchangeRate: number;
		date: string;
	};
	messagePattern: RegExp;
	name: string;
	rateTable: RateTableRow[];
}

/** Vectors that MUST reject with a `MoneyValidationError`. */
export const COMPUTE_USD_THROW_VECTORS: ComputeUsdThrowVector[] = [
	{
		input: {
			baseAmount: 1,
			date: ENTRY_DATE,
			exchangeRate: Number.MIN_VALUE,
			exchangeRateType: "custom",
		},
		messagePattern: /not finite/,
		name: "overflow guard: a sub-normal custom rate derives a non-finite amount",
		rateTable: [],
	},
	{
		input: {
			baseAmount: 100,
			date: ENTRY_DATE,
			exchangeRate: 50,
			exchangeRateType: "eur_reference",
		},
		messagePattern: /No EUR official rate/,
		name: "eur_reference with no cached EUR official leg blocks the entry",
		rateTable: [],
	},
];

export interface RoundMoneyVector {
	decimals?: number;
	expected: number;
	name: string;
	value: number;
}

/** Banker's-rounding (half-to-even) edges plus scale-up/no-op cases. */
export const ROUND_MONEY_VECTORS: RoundMoneyVector[] = [
	{ expected: 0.12, name: "0.125 -> 0.12 (round down to even)", value: 0.125 },
	{ expected: 0.38, name: "0.375 -> 0.38 (round up to even)", value: 0.375 },
	{ expected: 0.62, name: "0.625 -> 0.62 (round down to even)", value: 0.625 },
	{ expected: 0.88, name: "0.875 -> 0.88 (round up to even)", value: 0.875 },
	{
		expected: -0.12,
		name: "-0.125 -> -0.12 (symmetric half-even)",
		value: -0.125,
	},
	{
		decimals: 0,
		expected: 2,
		name: "2.5 -> 2 at 0 decimals (even)",
		value: 2.5,
	},
	{
		decimals: 0,
		expected: 4,
		name: "3.5 -> 4 at 0 decimals (even)",
		value: 3.5,
	},
	{
		decimals: 0,
		expected: 0,
		name: "0.5 -> 0 at 0 decimals (even)",
		value: 0.5,
	},
	{
		expected: 2.5,
		name: "2.5 -> 2.5 when target scale exceeds input",
		value: 2.5,
	},
	{ expected: 100, name: "100 -> 100 identity", value: 100 },

	// Binary-representation traps: a naive `Math.round(value * 100)` regresses
	// these (2.675 -> 2.67).
	{ expected: 2.68, name: "2.675 -> 2.68 (binary trap)", value: 2.675 },
	{ expected: 1, name: "1.005 -> 1.00 (binary trap, even)", value: 1.005 },
	{ expected: 1.02, name: "1.015 -> 1.02 (binary trap, odd)", value: 1.015 },
	{ expected: 0.62, name: "0.615 -> 0.62 (binary trap, odd)", value: 0.615 },

	// Clean near-half literals: the third decimal is an exact 5, so half-even
	// resolves on the even/odd neighbour of the shortest decimal.
	{
		expected: 1.14,
		name: "1.135 -> 1.14 (half-even up, odd neighbour)",
		value: 1.135,
	},
	{
		expected: 1.16,
		name: "1.155 -> 1.16 (half-even up, odd neighbour)",
		value: 1.155,
	},
	{
		expected: 0.1,
		name: "0.105 -> 0.10 (half-even down, even neighbour)",
		value: 0.105,
	},

	// Dirty near-half doubles: not ties. Locking the exact-decimal result makes a
	// naive `value * 10 ** n` toScaledInt fail.
	{
		expected: 1.13,
		name: "1.1349999999999998 -> 1.13 (below half; old epsilon gave 1.14)",
		value: 1.134_999_999_999_999_8,
	},
	{
		expected: 0.11,
		name: "0.10500000000000001 -> 0.11 (above half; old epsilon gave 0.10)",
		value: 0.105_000_000_000_000_01,
	},
];
