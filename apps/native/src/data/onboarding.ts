import { inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";
import { isOnboardingSettled } from "./onboarding-core";

export * from "./onboarding-core";

const GATE_KEYS = [META_KEYS.onboardingComplete, META_KEYS.currencyChosen];

export function useOnboardingSettled(db: Database): boolean {
	const rows = useLiveQuery(appMeta, () =>
		db.select().from(appMeta).where(inArray(appMeta.key, GATE_KEYS)),
	);
	const values = new Map(rows.map((row) => [row.key, row.value]));
	return isOnboardingSettled(
		values.get(META_KEYS.onboardingComplete) ?? null,
		values.get(META_KEYS.currencyChosen) ?? null,
	);
}
