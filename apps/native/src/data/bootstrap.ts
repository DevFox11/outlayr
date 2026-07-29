import type { Database } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { getMeta, META_KEYS, setMeta } from "./app-meta";
import { seedCategories } from "./categories";

/**
 * One-time first-launch setup, guarded by the `firstLaunch` meta key. Awaited by
 * `LocalDataProvider` before it reports `ready`, so the splash covers seeding and
 * the first screen already sees its categories.
 *
 * Locale-derived currency is a deliberate seam — `expo-localization` is not
 * installed (a native module would need a rebuild), so this resolves to USD.
 * When a locale source lands, resolve it here before the `setMeta` call.
 */
export async function bootstrapLocalData(db: Database): Promise<void> {
	const done = await getMeta(db, META_KEYS.firstLaunch);
	if (done === "true") {
		return;
	}
	// Atomic on purpose: the `firstLaunch` marker is written last, and first launch
	// is the most kill-prone moment. `seedCategories` guards itself too, so the
	// two defences are independent.
	await withTransaction(db, async () => {
		// TODO(phase-2): resolve device-locale currency once expo-localization is added.
		await setMeta(db, META_KEYS.currency, DEFAULT_CURRENCY);
		await seedCategories(db);
		await setMeta(db, META_KEYS.firstLaunch, "true");
	});
}
