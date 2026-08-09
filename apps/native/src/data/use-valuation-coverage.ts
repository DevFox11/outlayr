import { useEffect, useState } from "react";
import type { Database } from "@/db/client";
import type { ValuationCoverage } from "@/domain/valuation-coverage";
import { valuationCoverage } from "./canonicalize-backfill";

const NOTHING: ValuationCoverage = {
	beyondRateHistory: 0,
	converted: 0,
	pending: 0,
};

/**
 * Read once per mount rather than live: coverage only moves when a rate pull or
 * a canonicalization pass lands, both of which run on foreground, and the scan
 * behind it is not worth a listener that every transaction write would fire.
 *
 * Starts at zeroes, which reads as "nothing to report" — the honest state before
 * the scan has answered.
 */
export function useValuationCoverage(db: Database): ValuationCoverage {
	const [coverage, setCoverage] = useState<ValuationCoverage>(NOTHING);

	useEffect(() => {
		let cancelled = false;
		valuationCoverage(db).then((next) => {
			if (!cancelled) {
				setCoverage(next);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [db]);

	return coverage;
}
