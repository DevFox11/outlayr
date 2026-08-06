import { addDays, startOfDay } from "./dates";

const DAY_MS = 86_400_000;

/**
 * Milliseconds from `nowMs` to the next local midnight — the one instant at
 * which a date-bounded read answers differently with nothing having been
 * written.
 *
 * Measured through the local calendar rather than by adding a fixed day: the two
 * days a year a clock shifts are 23 and 25 hours long, so a fixed step lands an
 * hour into the next day or an hour short of it.
 */
export function nextClockTick(nowMs: number): number {
	const delay = addDays(startOfDay(new Date(nowMs)), 1).getTime() - nowMs;
	// A zone that gives an hour back exactly at 00:00 has a midnight that happens
	// twice, and the earlier of the two can already be behind `nowMs`. A whole day
	// is the next honest boundary; a delay of zero would fire on the instant it was
	// armed for and re-arm for zero, which spins.
	return delay > 0 ? delay : DAY_MS;
}

/**
 * How far the clock may run backwards and still be read as noise rather than a
 * correction. Generous in the accepting direction on purpose — see
 * {@link clockAdvances} for which way the two failures cut.
 */
const CLOCK_REGRESSION_TOLERANCE_MS = 60_000;

/**
 * Whether a candidate reading replaces the standing one.
 *
 * Forwards always wins. A repeat of the standing reading is refused: restating
 * the same millisecond re-renders every screen bounded by it without changing
 * what any of them show, which is what collapses a burst of triggers (a bulk
 * write reports every row it touched) into one restatement.
 *
 * Backwards is the interesting direction, and it is NOT refused outright. A small
 * regression is jitter, and honouring it would pull the ledger's upper bound
 * behind rows already listed and make them flicker. A large one is a real
 * correction — NTP catching up, or the owner fixing the date — and refusing it
 * leaves the bound stranded wherever a wrong clock put it. That matters because
 * the bound is what separates spent from scheduled: a reading stuck in the future
 * reports every charge the ledger has not reached yet as money already gone, and
 * it stays stuck for the life of the process.
 */
export function clockAdvances(currentMs: number, candidateMs: number): boolean {
	if (candidateMs > currentMs) {
		return true;
	}
	return currentMs - candidateMs > CLOCK_REGRESSION_TOLERANCE_MS;
}
