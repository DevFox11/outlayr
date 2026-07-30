import { eq } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { parseFavourites } from "@/domain/favourite-currencies";
import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";

export * from "./favourite-currencies-core";

export function useFavouriteCurrencies(db: Database): string[] {
	const rows = useLiveQuery(appMeta, () =>
		db
			.select()
			.from(appMeta)
			.where(eq(appMeta.key, META_KEYS.favouriteCurrencies)),
	);
	const stored = rows[0]?.value ?? null;
	// Keyed on the stored string so the parsed array keeps its identity across
	// renders the row did not change in — a picker memoised on it would otherwise
	// rebuild its cluster on every keystroke in the search field.
	return useMemo(() => parseFavourites(stored), [stored]);
}
