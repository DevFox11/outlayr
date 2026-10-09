import { utcDateString } from "./dates";
import { MoneyValidationError } from "./errors";
import { computeAmountUSD, resolveEntryRate } from "./rates";
import type { EntryRateType, RateLookup } from "./rates";

export interface CanonicalUsd {
    amountUsd: number | null;
    exchangeRate: number | null;
    exchangeRateType: string | null;
}

export interface CanonicalUsdInput {
    amount: number;
    /** Null means the entry is already in the ledger's display currency. */
    currency: string | null;
    date: Date;
    displayCurrency: string;
    /** An actual already-chosen rate, used verbatim after positive-finite validation. */
    exchangeRate?: number | null;
    /** Absent means official for a non-USD entry. */
    exchangeRateType?: EntryRateType | null;
}

/** No honest USD value could be frozen; downstream policy decides presentation. */
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
 * Returns nulls rather than throwing when no rate is available. Ordinary
 * unresolved rows retain their native-currency value; a custom row awaiting
 * its user-supplied rate is excluded from foreign scalar valuations.
 */
export async function canonicalUsd(lookup: RateLookup, input: CanonicalUsdInput): Promise<CanonicalUsd> {
    const currency = input.currency ?? input.displayCurrency;

    // A USD entry is already canonical, and its rate is 1 by definition.
    if (currency === "USD") {
        return {
            amountUsd: input.amount,
            exchangeRate: 1,
            exchangeRateType: null,
        };
    }

    const exchangeRateType = input.exchangeRateType ?? DEFAULT_RATE_TYPE;
    if (exchangeRateType === "eur_reference" && currency !== "VES") {
        return { amountUsd: null, exchangeRate: null, exchangeRateType };
    }
    if (exchangeRateType === "custom" && input.exchangeRate == null) {
        return { amountUsd: null, exchangeRate: null, exchangeRateType };
    }

    const date = utcDateString(input.date.getTime());
    try {
        const suppliedRate = input.exchangeRate;
        let exchangeRate: number | null;
        if (suppliedRate == null) {
            exchangeRate = await resolveEntryRate(lookup, currency, exchangeRateType, undefined, date);
        } else if (Number.isFinite(suppliedRate) && suppliedRate > 0) {
            exchangeRate = suppliedRate;
        } else {
            exchangeRate = null;
        }
        if (exchangeRate === null) {
            return { amountUsd: null, exchangeRate: null, exchangeRateType };
        }
        const amountUsd = computeAmountUSD({
            baseAmount: input.amount,
            date,
            exchangeRate,
            exchangeRateType,
        });
        return { amountUsd, exchangeRate, exchangeRateType };
    } catch (error) {
        // A validation failure cannot produce an honest figure — the same outcome as
        // having no rate at all, and never a reason to refuse the write.
        if (error instanceof MoneyValidationError) {
            return { ...UNRESOLVED, exchangeRateType };
        }
        throw error;
    }
}
