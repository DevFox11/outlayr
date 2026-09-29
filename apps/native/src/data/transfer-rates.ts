import type { EntryRateType } from "@outlayr/money/rates";
import { and, inArray } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";
import type { RateTable } from "@/domain/valuation";

import { useRatesRead } from "./live-query";

/**
 * The rate tables the transfer sheet quotes from, one per requested rate type,
 * for the pair it is on.
 */
export function useTransferRates(
    db: Database,
    codes: readonly string[],
    rateTypes: readonly EntryRateType[]
): Partial<Record<EntryRateType, RateTable>> {
    const quotes = useMemo(() => [...new Set(codes.filter((code) => code !== "USD"))].sort(), [codes]);
    const rows = useRatesRead(
        () =>
            db
                .select({
                    date: exchangeRates.date,
                    quote: exchangeRates.quote,
                    rate: exchangeRates.rate,
                    rateType: exchangeRates.rateType,
                })
                .from(exchangeRates)
                .where(
                    and(
                        inArray(exchangeRates.quote, quotes.length > 0 ? [...quotes] : [""]),
                        inArray(exchangeRates.rateType, rateTypes.length > 0 ? [...rateTypes] : [""])
                    )
                )
                .all(),
        [db, quotes.join(","), rateTypes.join(",")]
    );
    return useMemo(
        () =>
            Object.fromEntries(
                rateTypes.map((type) => [type, buildRateTable(rows.filter((row) => row.rateType === type))])
            ),
        [rows, rateTypes]
    );
}
