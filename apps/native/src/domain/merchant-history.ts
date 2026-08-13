import { merchantKey } from "./merchant-resolver";

export interface HistoricalEntry {
	categoryId: string;
	/** Epoch milliseconds, used only to break a tie between equal counts. */
	date: number;
	note: string;
}

/**
 * How the user has filed this merchant before, or null if they never have.
 *
 * The count decides rather than the most recent row: a single miscategorised
 * entry is exactly the case where the latest answer is the wrong one, and it is
 * also the case a user is most likely to correct next. Recency only breaks a
 * tie, where the newer of two equally-held opinions is the better guess.
 *
 * Candidates are matched on `merchantKey`, not on the raw note, so "Rio
 * Supermercado", "RIO SUPERMERCADO " and "rio  supermercado" are one merchant.
 */
export function rememberedCategory(entries: readonly HistoricalEntry[], key: string): string | null {
	if (key === "") {
		return null;
	}

	const counts = new Map<string, { count: number; latest: number }>();
	for (const entry of entries) {
		if (merchantKey(entry.note) !== key) {
			continue;
		}
		const tally = counts.get(entry.categoryId);
		if (tally == null) {
			counts.set(entry.categoryId, { count: 1, latest: entry.date });
			continue;
		}
		tally.count += 1;
		tally.latest = Math.max(tally.latest, entry.date);
	}

	let bestId: string | null = null;
	let best = { count: 0, latest: 0 };
	for (const [categoryId, tally] of counts) {
		if (tally.count > best.count || (tally.count === best.count && tally.latest > best.latest)) {
			bestId = categoryId;
			best = tally;
		}
	}
	return bestId;
}
