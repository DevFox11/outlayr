import type { EntryRateType } from "@outlayr/money/rates";
import { and, eq, inArray } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";
import type { RateTable } from "@/domain/valuation";

import { useLiveQuery } from "./live-query";

export function useTransferRates(db: Database, codes: readonly string[], rateType: EntryRateType): RateTable {
    const quotes = useMemo(() => [...new Set(codes.filter((code) => code !== "USD"))].sort(), [codes]);
    const rows = useLiveQuery(
        exchangeRates,
        () =>
            db
                .select({ date: exchangeRates.date, quote: exchangeRates.quote, rate: exchangeRates.rate })
                .from(exchangeRates)
                .where(
                    and(
                        inArray(exchangeRates.quote, quotes.length > 0 ? [...quotes] : [""]),
                        eq(exchangeRates.rateType, rateType)
                    )
                ),
        [quotes.join(","), rateType]
    );
    return useMemo(() => buildRateTable(rows), [rows]);
}
