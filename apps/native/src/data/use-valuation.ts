import { and, eq } from "drizzle-orm";
import { useMemo, useSyncExternalStore } from "react";
import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";
import { useGlobalCurrency } from "./app-meta";
import { useLiveQuery } from "./live-query";
import { ratesRevision, subscribeRatesRevision } from "./rates-revision";
import type { Valuation } from "./valuation-source";
import { VALUATION_RATE_TYPE } from "./valuation-source";

/**
 * The reactive twin of `loadValuation`. Live-queried rather than loaded once so
 * the figures follow the two things that change them — switching display
 * currency in Settings, and a rate refresh landing.
 *
 * A refresh does not reliably announce itself: the `DELETE FROM exchangeRates`
 * it opens with is exempt from the update hook `addDatabaseChangeListener` reads
 * (see `rates-revision.ts`), so the revision counter carries that half instead.
 */
export function useValuation(db: Database): Valuation {
	const displayCurrency = useGlobalCurrency(db);
	const revision = useSyncExternalStore(
		subscribeRatesRevision,
		ratesRevision,
		ratesRevision,
	);

	const rows = useLiveQuery(
		exchangeRates,
		() =>
			db
				.select({
					quote: exchangeRates.quote,
					date: exchangeRates.date,
					rate: exchangeRates.rate,
				})
				.from(exchangeRates)
				.where(
					and(
						eq(exchangeRates.quote, displayCurrency),
						eq(exchangeRates.rateType, VALUATION_RATE_TYPE),
					),
				),
		[displayCurrency, revision],
	);

	return useMemo(
		() => ({ displayCurrency, rates: buildRateTable(rows) }),
		[displayCurrency, rows],
	);
}
