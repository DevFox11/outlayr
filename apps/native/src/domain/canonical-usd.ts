import { utcDateString } from "@outlayr/money/dates";
import { MoneyValidationError } from "@outlayr/money/errors";
import { computeAmountUSD, type EntryRateType, type RateLookup, resolveEntryRate } from "@outlayr/money/rates";

export interface CanonicalUsd {
	amountUsd: number | null;
	exchangeRate: number | null;
	exchangeRateType: string | null;
}

/** Nothing to freeze — the row aggregates at face value. */
const UNRESOLVED: CanonicalUsd = {
	amountUsd: null,
	exchangeRate: null,
	exchangeRateType: null,
};

/**
 * The market rate a plain entry uses. `custom` is a rate the user personally
 * transacted at (a P2P operation) and `eur_reference` is VES-only; both need
 * the form to offer them before this can be anything else.
 */
const DEFAULT_RATE_TYPE: EntryRateType = "official";

/**
 * Freezes an amount's USD value at the rate of the day it happened.
 *
 * Note the direction: a stored rate is currency-PER-USD, so USD is the amount
 * DIVIDED by it. `computeAmountUSD` does that division in scaled integers with
 * a single half-even rounding, which is why the arithmetic is not done here.
 *
 * Returns nulls rather than throwing when no rate is available; the row
 * aggregates at face value until a later pass fills it in.
 */
export async function canonicalUsd(
	lookup: RateLookup,
	input: {
		amount: number;
		/** Null means the entry is already in the ledger's display currency. */
		currency: string | null;
		displayCurrency: string;
		date: Date;
	}
): Promise<CanonicalUsd> {
	const currency = input.currency ?? input.displayCurrency;

	// A USD entry is already canonical, and its rate is 1 by definition.
	if (currency === "USD") {
		return {
			amountUsd: input.amount,
			exchangeRate: 1,
			exchangeRateType: null,
		};
	}

	const date = utcDateString(input.date.getTime());
	try {
		const exchangeRate = await resolveEntryRate(lookup, currency, DEFAULT_RATE_TYPE, undefined, date);
		const amountUsd = await computeAmountUSD(lookup, {
			baseAmount: input.amount,
			date,
			exchangeRate,
			exchangeRateType: DEFAULT_RATE_TYPE,
		});
		return { amountUsd, exchangeRate, exchangeRateType: DEFAULT_RATE_TYPE };
	} catch (error) {
		// A validation failure cannot produce an honest figure — the same outcome as
		// having no rate at all, and never a reason to refuse the write.
		if (error instanceof MoneyValidationError) {
			return UNRESOLVED;
		}
		throw error;
	}
}
