import { inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";
import { isAccountDeferred, isOnboardingSettled, isReminderChosen } from "./onboarding-core";

export * from "./onboarding-core";

const GATE_KEYS = [META_KEYS.onboardingComplete, META_KEYS.accountDeferred, META_KEYS.reminderChosen];

function useGateMeta(db: Database): Map<string, string | null> {
	const rows = useLiveQuery(appMeta, () => db.select().from(appMeta).where(inArray(appMeta.key, GATE_KEYS)));
	return new Map(rows.map((row) => [row.key, row.value]));
}

export function useOnboardingSettled(db: Database): boolean {
	const values = useGateMeta(db);
	return isOnboardingSettled(values.get(META_KEYS.onboardingComplete) ?? null);
}

export function useAccountDeferred(db: Database): boolean {
	const values = useGateMeta(db);
	return isAccountDeferred(values.get(META_KEYS.accountDeferred) ?? null);
}

export function useReminderChosen(db: Database): boolean {
	const values = useGateMeta(db);
	return isReminderChosen(values.get(META_KEYS.reminderChosen) ?? null);
}
