import { roundMoney } from "@outlayr/money/round";

/**
 * Bulgaria's currency-board peg: the lev is irrevocably fixed at 1.95583 BGN per
 * EUR. BGN is not in the catalog, so existing BGN entries re-currency to EUR at
 * exactly this rate, with no market drift.
 */
export const BGN_PER_EUR = 1.955_83;

const EUR_EXPONENT = 2;

export interface EurBaseLeg {
	baseAmount: number;
	baseCurrency: "EUR";
	exchangeRate: number;
}

/**
 * `exchangeRate` is left UNROUNDED on purpose: dividing both legs by the same
 * peg leaves their ratio (`baseAmount / exchangeRate`, the canonical USD)
 * invariant, so stored USD canonicals stay correct without being recomputed.
 */
export function bgnBaseLegToEur(baseAmount: number, exchangeRate: number): EurBaseLeg {
	return {
		baseAmount: roundMoney(baseAmount / BGN_PER_EUR, EUR_EXPONENT),
		baseCurrency: "EUR",
		exchangeRate: exchangeRate / BGN_PER_EUR,
	};
}
