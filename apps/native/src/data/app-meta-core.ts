import { eq } from "drizzle-orm";
import { appMeta } from "@/db/schema";
import type { SpendDb } from "./budget-spent";

/**
 * Kept separate from `app-meta.ts` so it never value-imports
 * `drizzle-orm/expo-sqlite`, whose React Native transitive import cannot load
 * under the node test runner.
 */
export const META_KEYS = {
	firstLaunch: "firstLaunch",
	currency: "currency",
	/**
	 * Set the first time the user picks a currency themselves. `bootstrap` seeds
	 * `currency` with the app default unconditionally, so without this the stored
	 * code cannot be told apart from one nobody ever chose.
	 */
	currencyChosen: "currencyChosen",
	/**
	 * Set once the orphaned-chain repair has run. Deleting a schedule carrier now
	 * retires it, so any tombstone still holding one predates that and is repaired
	 * exactly once rather than on every sweep.
	 */
	recurrenceRepaired: "recurrenceRepaired",
	/**
	 * Written when the first-run flow finishes. `firstLaunch` cannot stand in for
	 * it: bootstrap writes that one before any screen exists, so by the time the
	 * flow could run it already reads as done.
	 */
	onboardingComplete: "onboardingComplete",
} as const;

export async function getMeta(
	db: SpendDb,
	key: string,
): Promise<string | null> {
	const rows = await db
		.select()
		.from(appMeta)
		.where(eq(appMeta.key, key))
		.limit(1);
	return rows[0]?.value ?? null;
}

export async function setMeta(
	db: SpendDb,
	key: string,
	value: string,
): Promise<void> {
	await db
		.insert(appMeta)
		.values({ key, value })
		.onConflictDoUpdate({ target: appMeta.key, set: { value } });
}
