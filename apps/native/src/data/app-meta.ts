import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";

/**
 * Bootstrap writes the resolved value before the splash lifts, so the USD
 * fallback is a type-level guard, not a startup state. Transactions with a null
 * currency render against this.
 */
export function useGlobalCurrency(db: Database): string {
	const rows = useLiveQuery(appMeta, () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.currency)));
	return rows[0]?.value ?? DEFAULT_CURRENCY;
}
