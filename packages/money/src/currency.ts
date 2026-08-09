import { CURRENCY_DECIMALS, CURRENCY_META, PICKABLE_CURRENCY_CODES, type PickableCode } from "./catalog.generated";

/**
 * Ingestible AND pickable (Decision #707): a labeled SUBSET of the generated
 * catalog, not an exclusion from it — metals canonicalize through USD like any
 * fiat code.
 */
export const METAL_CURRENCY_CODES = ["XAU", "XAG", "XPT", "XPD"] as const;

export const DEFAULT_MONEY_DECIMALS = 2;

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

export function decimalsFor(code: string): 0 | 2 | 3 {
	return isPickableCode(code) ? CURRENCY_DECIMALS[code] : DEFAULT_MONEY_DECIMALS;
}
