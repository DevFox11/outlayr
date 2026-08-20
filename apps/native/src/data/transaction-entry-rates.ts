import { utcDateString } from "@outlayr/money/dates";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";

import type { Database } from "@/db/client";
import { exchangeRates, transactions } from "@/db/schema";

export interface TransactionRateSuggestions {
    /**
     * The second leg of an `eur_reference` conversion, EUR per USD. Exposed
     * because that policy is two-legged: `exchangeRate` alone converts to EUR,
     * and a caller stating a USD figure has to divide by this as well.
     */
    eurOfficial: number | null;
    eurReference: number | null;
    official: number | null;
    priorCustom: { date: Date; rate: number } | null;
}

function providerRate(
    db: Database,
    currency: string,
    rateType: "eur_reference" | "official",
    date: string
): number | null {
    const [row] = db
        .select({ rate: exchangeRates.rate })
        .from(exchangeRates)
        .where(
            and(eq(exchangeRates.quote, currency), eq(exchangeRates.rateType, rateType), lte(exchangeRates.date, date))
        )
        .orderBy(desc(exchangeRates.date))
        .limit(1)
        .all();
    return row?.rate ?? null;
}

export function transactionRateSuggestions(db: Database, currency: string, date: Date): TransactionRateSuggestions {
    const rateDate = utcDateString(date.getTime());
    const official = providerRate(db, currency, "official", rateDate);
    const vesEurReference = currency === "VES" ? providerRate(db, currency, "eur_reference", rateDate) : null;
    const eurOfficial = vesEurReference === null ? null : providerRate(db, "EUR", "official", rateDate);
    const [priorCustom] = db
        .select({ date: transactions.date, rate: transactions.exchangeRate })
        .from(transactions)
        .where(
            and(
                eq(transactions.currency, currency),
                eq(transactions.exchangeRateType, "custom"),
                gt(transactions.exchangeRate, 0),
                lte(transactions.date, date),
                isNull(transactions.deletedAt)
            )
        )
        .orderBy(desc(transactions.date), desc(transactions.id))
        .limit(1)
        .all();

    return {
        eurOfficial,
        eurReference: eurOfficial === null ? null : vesEurReference,
        official,
        priorCustom:
            priorCustom?.rate == null
                ? null
                : {
                      date: priorCustom.date,
                      rate: priorCustom.rate,
                  },
    };
}
