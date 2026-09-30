import { utcDateString } from "@outlayr/money/dates";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";

import type { Database } from "@/db/client";
import { exchangeRates, transactions } from "@/db/schema";

export interface TransactionRateSuggestions {
    eurReference: number | null;
    eurReferenceDate: string | null;
    eurReferenceFetchedAt: number | null;
    official: number | null;
    officialDate: string | null;
    officialFetchedAt: number | null;
    priorCustom: { date: Date; rate: number } | null;
}

function providerRate(
    db: Database,
    currency: string,
    rateType: "eur_reference" | "official",
    date: string
): { date: string; fetchedAt: number; rate: number } | null {
    const [row] = db
        .select({ date: exchangeRates.date, fetchedAt: exchangeRates.fetchedAt, rate: exchangeRates.rate })
        .from(exchangeRates)
        .where(
            and(eq(exchangeRates.quote, currency), eq(exchangeRates.rateType, rateType), lte(exchangeRates.date, date))
        )
        .orderBy(desc(exchangeRates.date))
        .limit(1)
        .all();
    return row ?? null;
}

export function transactionRateSuggestions(db: Database, currency: string, date: Date): TransactionRateSuggestions {
    const rateDate = utcDateString(date.getTime());
    const official = providerRate(db, currency, "official", rateDate);
    const eurReference = currency === "VES" ? providerRate(db, currency, "eur_reference", rateDate) : null;
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
        eurReference: eurReference?.rate ?? null,
        eurReferenceDate: eurReference?.date ?? null,
        eurReferenceFetchedAt: eurReference?.fetchedAt ?? null,
        official: official?.rate ?? null,
        officialDate: official?.date ?? null,
        officialFetchedAt: official?.fetchedAt ?? null,
        priorCustom:
            priorCustom?.rate == null
                ? null
                : {
                      date: priorCustom.date,
                      rate: priorCustom.rate,
                  },
    };
}
