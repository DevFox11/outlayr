import { and, eq } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";

import { useGlobalCurrency } from "./app-meta";
import { useRatesRead } from "./live-query";
import type { Valuation } from "./valuation-source";
import { VALUATION_RATE_TYPE } from "./valuation-source";

/** The reactive twin of `loadValuationIn`. */
export function useValuationIn(db: Database, code: string): Valuation {
    const rows = useRatesRead(
        () =>
            db
                .select({
                    date: exchangeRates.date,
                    quote: exchangeRates.quote,
                    rate: exchangeRates.rate,
                })
                .from(exchangeRates)
                .where(and(eq(exchangeRates.quote, code), eq(exchangeRates.rateType, VALUATION_RATE_TYPE)))
                .all(),
        [db, code]
    );

    return useMemo(() => ({ displayCurrency: code, rates: buildRateTable(rows) }), [code, rows]);
}

/** {@link useValuationIn} for the ledger's own display currency. */
export function useValuation(db: Database): Valuation {
    return useValuationIn(db, useGlobalCurrency(db));
}
