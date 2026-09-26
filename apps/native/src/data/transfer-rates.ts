import type { EntryRateType } from "@outlayr/money/rates";
import { and, inArray } from "drizzle-orm";
import { useMemo, useSyncExternalStore } from "react";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";
import type { RateTable } from "@/domain/valuation";

import { useLiveQuery } from "./live-query";
import { ratesRevision, subscribeRatesRevision } from "./rates-revision";

/**
 * The rate tables the transfer sheet quotes from, one per requested rate type,
 * for the pair it is on.
 *
 * The revision counter is in the deps for the same reason it is in
 * `useValuationIn` and `useValuedCurrencies`: a refresh opens with an
 * unqualified `DELETE FROM exchangeRates`, which SQLite's truncate optimization
 * exempts from the update hook `useLiveQuery` is built on. Without it this hook
 * alone never learned a refresh had landed, so a sheet opened before the first
 * pull kept answering `null` for the market rate for its whole life and made the
 * user type one by hand.
 */
export function useTransferRates(
    db: Database,
    codes: readonly string[],
    rateTypes: readonly EntryRateType[]
): Partial<Record<EntryRateType, RateTable>> {
    const revision = useSyncExternalStore(subscribeRatesRevision, ratesRevision, ratesRevision);
    const quotes = useMemo(() => [...new Set(codes.filter((code) => code !== "USD"))].sort(), [codes]);
    const rows = useLiveQuery(
        exchangeRates,
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
                ),
        [quotes.join(","), rateTypes.join(","), revision]
    );
    return useMemo(
        () =>
            Object.fromEntries(
                rateTypes.map((type) => [type, buildRateTable(rows.filter((row) => row.rateType === type))])
            ),
        [rows, rateTypes]
    );
}
