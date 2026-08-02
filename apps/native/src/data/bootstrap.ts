import { getLocales } from "expo-localization";
import type { Database } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import {
	seedFavourites,
	serialiseFavourites,
} from "@/domain/favourite-currencies";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { getMeta, META_KEYS, setMeta } from "./app-meta";
import { seedCategories } from "./categories";

/**
 * One-time first-launch setup, guarded by the `firstLaunch` meta key. Awaited by
 * `LocalDataProvider` before it reports `ready`, so the splash covers seeding and
 * the first screen already sees its categories.
 *
 * The ledger's own currency stays `DEFAULT_CURRENCY`: onboarding asks for it on
 * its own screen, so seeding a locale guess here would only be a default the user
 * is about to overwrite. The locale is used for the favourites cluster instead,
 * where being wrong costs a row nobody taps rather than the currency every future
 * entry is recorded in.
 */
export async function bootstrapLocalData(db: Database): Promise<void> {
	const done = await getMeta(db, META_KEYS.firstLaunch);
	if (done === "true") {
		return;
	}
	// Behind the `firstLaunch` guard, so a user who clears the cluster keeps it
	// cleared rather than having it grow back on the next launch.
	const favourites = seedFavourites(getLocales()[0]?.currencyCode ?? null);

	// Atomic on purpose: the `firstLaunch` marker is written last, and first launch
	// is the most kill-prone moment. `seedCategories` guards itself too, so the
	// two defences are independent.
	await withTransaction(db, async () => {
		await setMeta(db, META_KEYS.currency, DEFAULT_CURRENCY);
		await setMeta(
			db,
			META_KEYS.favouriteCurrencies,
			serialiseFavourites(favourites),
		);
		await seedCategories(db);
		await setMeta(db, META_KEYS.firstLaunch, "true");
	});
}
