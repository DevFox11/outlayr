/** How much of the ledger the converted figures on screen actually rest on. */
export interface ValuationCoverage {
	/** Rows carrying a frozen USD value. */
	converted: number;
	/** Rows a later rate pull can still value. */
	pending: number;
	/**
	 * Rows dated before the earliest rate their currency has. The server serves a
	 * bounded window and every pull wipe-replaces the local table, so no later
	 * pull reaches back to them — face value is final, not provisional.
	 */
	beyondRateHistory: number;
}

const CATCHING_UP = "Rates are still catching up";
const AS_LOGGED = "counted at the amount they were logged in";

/** Null when every figure on screen is a converted one. */
export function coverageNote(coverage: ValuationCoverage): string | null {
	const { converted, pending, beyondRateHistory } = coverage;
	const total = converted + pending + beyondRateHistory;
	if (total === 0 || (pending === 0 && beyondRateHistory === 0)) {
		return null;
	}
	if (pending === 0) {
		return `${beyondRateHistory} of ${total} entries predate the rate history, so they are ${AS_LOGGED}.`;
	}
	const catching = `${CATCHING_UP}: ${pending} of ${total} entries are ${AS_LOGGED}.`;
	if (beyondRateHistory === 0) {
		return catching;
	}
	return `${catching} ${beyondRateHistory} more predate the rate history and always will be.`;
}
