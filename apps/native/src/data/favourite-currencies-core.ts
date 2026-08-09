import type { Database } from "@/db/client";
import { parseFavourites, serialiseFavourites, toggleFavourite } from "@/domain/favourite-currencies";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";

export async function readFavourites(db: Database): Promise<string[]> {
	return parseFavourites(await getMeta(db, META_KEYS.favouriteCurrencies));
}

/**
 * Every `appMeta` write schedules a widget republish: `affectsWidgets` matches on
 * the table, not the key, so a favourite lands in the same 750ms debounce as a
 * transaction (`lib/sync-cadence.ts`). That is a fair price for a toggle the user
 * tapped, and the reason a per-screen currency override — which changes as fast
 * as a scroll — stays in screen state and never comes through here.
 */
export async function writeFavourites(db: Database, codes: readonly string[]): Promise<void> {
	await setMeta(db, META_KEYS.favouriteCurrencies, serialiseFavourites(codes));
}

/**
 * Toggles run one at a time. The read-modify-write straddles an `await`, so two
 * taps dispatched before the first write commits would both read the pre-write
 * list and the second would overwrite the first — a double-tap on a star, or two
 * stars a tick apart, silently loses one.
 *
 * `catch` keeps the chain alive: without it one rejected toggle would wedge every
 * later one behind a permanently failed promise.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Answers the list as it now stands so the caller can tell an add refused at the
 * limit from one that landed — same length in, same length out — without
 * re-reading and racing its own write.
 *
 * The write is unconditional rather than skipped on a refusal: it is also what
 * flushes codes the catalogue has since retired, which `readFavourites` hides
 * but leaves stored.
 */
export function toggleFavouriteCurrency(db: Database, code: string): Promise<string[]> {
	const run = queue.then(async () => {
		const next = toggleFavourite(await readFavourites(db), code);
		await writeFavourites(db, next);
		return next;
	});
	queue = run.catch(() => {
		// Swallowed so one failed write does not poison the queue.
	});
	return run;
}
