import { calculator, dinero, halfEven, toDecimal, transformScale, USD } from "dinero.js/bigint";
import { CURRENCY_DECIMALS, CURRENCY_META, PICKABLE_CURRENCY_CODES, type PickableCode } from "./catalog.generated";

export class MoneyValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MoneyValidationError";
	}
}

/** `binance` is VES-per-USDT market data only — never an entry type. */
export const MARKET_RATE_TYPES = ["official", "eur_reference", "binance"] as const;

/**
 * Deliberately diverges from `MARKET_RATE_TYPES`: `binance` is excluded
 * (USDT != USD), `custom` is added for user-supplied operation rates.
 */
export const ENTRY_RATE_TYPES = ["official", "eur_reference", "custom"] as const;

export type MarketRateType = (typeof MARKET_RATE_TYPES)[number];
export type EntryRateType = (typeof ENTRY_RATE_TYPES)[number];

/**
 * Ingestible AND pickable (Decision #707): a labeled SUBSET of the generated
 * catalog, not an exclusion from it — metals canonicalize through USD like any
 * fiat code.
 */
export const METAL_CURRENCY_CODES = ["XAU", "XAG", "XPT", "XPD"] as const;

export type { PickableCode } from "./catalog.generated";
/**
 * The pickable catalog, its per-code fraction digits, and its display metadata
 * are GENERATED from the provider list + CLDR (`catalog.generated.ts`, guarded
 * by a drift test).
 */
export {
	CURRENCY_DECIMALS,
	CURRENCY_META,
	PICKABLE_CURRENCY_CODES,
} from "./catalog.generated";

const PICKABLE_CURRENCY_SET: ReadonlySet<string> = new Set(PICKABLE_CURRENCY_CODES);

export function isPickableCurrency(code: string): boolean {
	return PICKABLE_CURRENCY_SET.has(code);
}

function isPickableCode(code: string): code is PickableCode {
	return PICKABLE_CURRENCY_SET.has(code);
}

export function currencyDisplayFor(code: string): {
	name: string;
	symbol: string;
} {
	return isPickableCode(code) ? CURRENCY_META[code] : { name: code, symbol: code };
}

const DEFAULT_MONEY_DECIMALS = 2;
const DATE_STRING_LENGTH = 10;
const MAX_EPOCH_MS = 8.64e15;
const DECIMAL_RADIX = 10n;

/**
 * Canonical USD is stored at scale 6 (micro-dollars); six places carry every
 * realistic rate division with sub-cent precision.
 *
 * Exactness ceiling: the micro-dollar integer is returned to JS as a `number`,
 * so it is exact only up to `Number.MAX_SAFE_INTEGER` (2^53 - 1) micro-dollars
 * ≈ $9,007,199,254.74 (~$9.007B). A magnitude above that loses sub-micro
 * precision without ever becoming non-finite, so the overflow guard does not
 * reject it. True overflow (e.g. a sub-normal rate) still produces a non-finite
 * number and is rejected.
 */
const USD_SCALE = 6n;

interface ScaledInt {
	amount: bigint;
	scale: bigint;
}

/**
 * Reads the number's shortest round-trip decimal string, which is spec-defined
 * and therefore identical on V8 and Hermes.
 */
function toScaledInt(value: number): ScaledInt {
	if (!Number.isFinite(value)) {
		throw new MoneyValidationError(`Cannot represent a non-finite number as a scaled integer: ${value}`);
	}
	// `Number.prototype.toString` only ever emits a lowercase `e` exponent.
	const [mantissa = "0", exponentPart] = value.toString().split("e");
	const exponent = exponentPart ? Number.parseInt(exponentPart, 10) : 0;
	const negative = mantissa.startsWith("-");
	const unsigned = negative ? mantissa.slice(1) : mantissa;
	const [integerDigits = "", fractionDigits = ""] = unsigned.split(".");
	const digits = `${integerDigits}${fractionDigits}`;
	let amount = BigInt(digits === "" ? "0" : digits);
	let scale = fractionDigits.length - exponent;
	if (scale < 0) {
		amount *= DECIMAL_RADIX ** BigInt(-scale);
		scale = 0;
	}
	return { amount: negative ? -amount : amount, scale: BigInt(scale) };
}

/**
 * Dinero multiplies but does not divide by an arbitrary rate, so a conversion
 * is expressed as ONE exact rational and rounded once here instead of inverting
 * the rate first (which `convert()` would require).
 */
function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
	return halfEven(numerator, denominator, calculator);
}

/**
 * Rate rows pin their `date` to UTC so both fetchers agree across
 * local-midnight boundaries.
 */
export function utcDateString(epochMs: number): string {
	return new Date(epochMs).toISOString().slice(0, DATE_STRING_LENGTH);
}

/**
 * Half-to-even rounding of the value's exact decimal, not of its binary double:
 * `2.675 -> 2.68`. Display/aggregation only — canonical USD is stored unrounded,
 * so totals must be summed at full precision and rounded once on the sum.
 */
export function roundMoney(value: number, decimals: number = DEFAULT_MONEY_DECIMALS): number {
	if (!Number.isFinite(value)) {
		throw new Error(`roundMoney received a non-finite value: ${value}`);
	}
	const { amount, scale } = toScaledInt(value);
	const money = dinero({ amount, currency: USD, scale });
	const rounded = transformScale(money, BigInt(decimals), halfEven);
	return Number(toDecimal(rounded));
}

function decimalsFor(code: string): 0 | 2 | 3 {
	return isPickableCode(code) ? CURRENCY_DECIMALS[code] : DEFAULT_MONEY_DECIMALS;
}

/**
 * `rate === 1` (USD selection) returns the amount unchanged: an exact identity
 * that skips the rounding pass and so preserves sub-cent precision.
 */
export function convertFromUsd(amountUsd: number, rate: number, code: string): number {
	assertFiniteNumber(amountUsd, "amountUsd");
	assertFiniteNumber(rate, "rate");
	if (rate === 1) {
		return amountUsd;
	}
	const amount = toScaledInt(amountUsd);
	const scaledRate = toScaledInt(rate);
	const product = dinero({
		amount: amount.amount * scaledRate.amount,
		currency: USD,
		scale: amount.scale + scaledRate.scale,
	});
	const rounded = transformScale(product, BigInt(decimalsFor(code)), halfEven);
	return Number(toDecimal(rounded));
}

/**
 * Convex's float64 type accepts non-finite values, so every user-supplied
 * number must pass this guard before it is stored or fed into date/rate math.
 */
export function assertFiniteNumber(value: number, label: string): void {
	if (!Number.isFinite(value)) {
		throw new MoneyValidationError(`${label} must be a finite number, got: ${value}`);
	}
}

export function assertOptionalFiniteNumber(value: number | undefined, label: string): void {
	if (value !== undefined) {
		assertFiniteNumber(value, label);
	}
}

/**
 * Epoch milliseconds beyond |8.64e15| are finite — they pass
 * `assertFiniteNumber` — but would make `utcDateString` throw a raw RangeError.
 */
export function assertValidEpochMs(value: number, label: string): void {
	assertFiniteNumber(value, label);
	if (Math.abs(value) > MAX_EPOCH_MS) {
		throw new MoneyValidationError(`${label} must be a valid epoch-milliseconds timestamp, got: ${value}`);
	}
}

export function assertOptionalValidEpochMs(value: number | undefined, label: string): void {
	if (value !== undefined) {
		assertValidEpochMs(value, label);
	}
}

export interface RateRow {
	date: string;
	rate: number;
}

/** Must return the newest row on or before `date`, else `null`. */
export type RateLookup = (quote: string, rateType: MarketRateType, date: string) => Promise<RateRow | null>;

/**
 * - `eur_reference` is VES-only: its mid is VES-per-EUR.
 * - A resolved rate must be positive; a non-positive one would later divide the
 *   base amount into a garbage or non-finite USD value.
 */
export async function resolveEntryRate(
	lookup: RateLookup,
	currency: string,
	rateType: EntryRateType,
	customRate: number | undefined,
	date: string
): Promise<number> {
	if (rateType === "custom") {
		if (customRate === undefined) {
			throw new MoneyValidationError('customRate is required when exchangeRateType is "custom"');
		}
		if (!Number.isFinite(customRate) || customRate <= 0) {
			throw new MoneyValidationError("customRate must be a positive number");
		}
		return customRate;
	}
	if (customRate !== undefined) {
		throw new MoneyValidationError('customRate is only allowed when exchangeRateType is "custom"');
	}
	if (rateType === "eur_reference" && currency !== "VES") {
		throw new MoneyValidationError("eur_reference rates are only available for VES amounts");
	}
	const row = await lookup(currency, rateType, date);
	if (!row) {
		throw new MoneyValidationError(`No ${rateType} rate available for ${currency} on ${date}`);
	}
	if (!Number.isFinite(row.rate) || row.rate <= 0) {
		throw new MoneyValidationError(
			`Resolved ${rateType} rate for ${currency} on ${date} must be a positive number, got: ${row.rate}`
		);
	}
	return row.rate;
}

export interface ComputeAmountUSDInput {
	baseAmount: number;
	date: string;
	exchangeRate: number;
	exchangeRateType: EntryRateType;
}

/**
 * `numerator / Π denominators`, evaluated as one exact rational and reduced to
 * a micro-dollar (`USD_SCALE`) integer with a SINGLE half-even rounding.
 */
function divideToUsd(numerator: ScaledInt, denominators: ScaledInt[]): number {
	let denominatorScaleSum = 0n;
	let denominatorProduct = 1n;
	for (const denominator of denominators) {
		denominatorScaleSum += denominator.scale;
		denominatorProduct *= denominator.amount;
	}
	if (denominatorProduct === 0n) {
		return Number.POSITIVE_INFINITY;
	}
	const scaledNumerator = numerator.amount * DECIMAL_RADIX ** (denominatorScaleSum + USD_SCALE);
	const scaledDenominator = denominatorProduct * DECIMAL_RADIX ** numerator.scale;
	const micro = divideHalfEven(scaledNumerator, scaledDenominator);
	const money = dinero({ amount: micro, currency: USD, scale: USD_SCALE });
	return Number(toDecimal(money));
}

/**
 * Freezes an UNROUNDED (micro-dollar precision) USD amount.
 *
 * `eur_reference` (VES-only) is two-legged: the stored `exchangeRate` is the
 * VES-per-EUR mid, so the amount is `baseAmount / exchangeRate / eurRate` with
 * the EUR leg resolved as the EUR `official` rate on `date`.
 *
 * A finite `(baseAmount, exchangeRate)` pair can still overflow the division to
 * a non-representable amount, which is rejected here rather than stored.
 */
export async function computeAmountUSD(lookup: RateLookup, input: ComputeAmountUSDInput): Promise<number> {
	const numerator = toScaledInt(input.baseAmount);
	const denominators: ScaledInt[] = [toScaledInt(input.exchangeRate)];
	if (input.exchangeRateType === "eur_reference") {
		const eurRow = await lookup("EUR", "official", input.date);
		if (!eurRow) {
			throw new MoneyValidationError(`No EUR official rate available on ${input.date} for eur_reference conversion`);
		}
		denominators.push(toScaledInt(eurRow.rate));
	}
	const amountUSD = divideToUsd(numerator, denominators);
	if (!Number.isFinite(amountUSD)) {
		throw new MoneyValidationError(
			`Computed USD amount is not finite (baseAmount ${input.baseAmount} at rate ${input.exchangeRate})`
		);
	}
	return amountUSD;
}
