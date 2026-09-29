import { eq } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";

import { useRatesRead } from "./live-query";
import { VALUATION_RATE_TYPE } from "./valuation-source";

/**
 * Every currency the rate table can express a figure in.
 *
 * Separate from {@link import("./use-valuation").useValuationIn}, which loads the
 * rates for ONE currency because that is all a conversion needs. Asking that
 * table whether some other code is reachable always answers no, so a caller that
 * uses it to decide what to *offer* silently offers nothing — see #237.
 *
 * This answers the offering question instead: not "what is the rate" but "is
 * there one at all", which is a distinct-quote scan and needs no rate rows
 * resident.
 *
 * USD is absent by design. It is the canonical side of every stored rate, so it
 * is reachable without a row of its own; callers add it themselves rather than
 * have this claim a row exists that does not.
 */
export function useValuedCurrencies(db: Database): ReadonlySet<string> {
    const rows = useRatesRead(
        () =>
            db
                .selectDistinct({ quote: exchangeRates.quote })
                .from(exchangeRates)
                .where(eq(exchangeRates.rateType, VALUATION_RATE_TYPE))
                .all(),
        [db]
    );

    return useMemo(() => new Set(rows.map((row) => row.quote)), [rows]);
}
