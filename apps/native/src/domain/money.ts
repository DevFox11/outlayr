import {
	CURRENCY_DECIMALS,
	currencyDisplayFor,
	roundMoney,
} from "@outlayr/money";

export const DEFAULT_CURRENCY = "USD";

/**
 * Currency exponents come from the `@outlayr/money` catalog (0 for JPY-style, 2
 * for most, 3 for KWD-style dinars); an unknown code falls back to 2.
 */
export function minorUnitsFor(code: string): number {
	return code in CURRENCY_DECIMALS
		? CURRENCY_DECIMALS[code as keyof typeof CURRENCY_DECIMALS]
		: 2;
}

export function currencySymbol(code: string): string {
	return currencyDisplayFor(code).symbol;
}

export interface AmountParts {
	symbol: string;
	/** Grouped integer portion, e.g. "1,240". */
	integer: string;
	/** Zero-padded fraction of `minorUnits` length, or "" when the code has none. */
	fraction: string;
	minorUnits: number;
}

/**
 * Splits a positive magnitude into display parts for a currency code. Grouping
 * and the decimal point are en-US style ("," thousands, "." decimal) — Hermes
 * lacks full ICU, so `Intl.NumberFormat` is avoided. The magnitude is rounded to
 * the code's minor units via `@outlayr/money`'s exact half-even `roundMoney`.
 *
 * `showCents` mirrors the Swift "Display Cents" setting: when false the value is
 * rounded to whole units and no fraction is emitted.
 */
export function amountParts(
	amount: number,
	code: string,
	showCents = true,
): AmountParts {
	const minorUnits = showCents ? minorUnitsFor(code) : 0;
	const rounded = roundMoney(Math.abs(amount), minorUnits);
	const fixed = rounded.toFixed(minorUnits);
	const [intRaw = "0", fractionRaw = ""] = fixed.split(".");
	const integer = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return {
		symbol: currencySymbol(code),
		integer,
		fraction: minorUnits > 0 ? fractionRaw : "",
		minorUnits,
	};
}

/**
 * Unsigned display string for a magnitude, e.g. "$1,240.00" (or "¥1,240" for a
 * zero-minor-unit currency).
 */
export function formatAmount(
	amount: number,
	code: string,
	showCents = true,
): string {
	const parts = amountParts(amount, code, showCents);
	return `${parts.symbol}${parts.integer}${
		parts.fraction ? `.${parts.fraction}` : ""
	}`;
}
