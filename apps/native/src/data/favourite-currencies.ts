import { eq } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { parseFavourites } from "@/domain/favourite-currencies";

import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";

/**
 * `db` is nullable because the currency picker sheet is mounted by forms whose
 * callers can sit above the root splash gate, where `useDatabase()` throws. No
 * open database resolves to no favourites — never to an error.
 */
export function useFavouriteCurrencies(db: Database | null): string[] {
    const rows = useLiveQuery(
        appMeta,
        () =>
            db === null
                ? { all: (): { value: string | null }[] => [] }
                : db
                      .select({ value: appMeta.value })
                      .from(appMeta)
                      .where(eq(appMeta.key, META_KEYS.favouriteCurrencies)),
        [db]
    );
    const stored = rows[0]?.value ?? null;
    // Keyed on the stored string so the parsed array keeps its identity across
    // renders the row did not change in — a picker memoised on it would otherwise
    // rebuild its cluster on every keystroke in the search field.
    return useMemo(() => parseFavourites(stored), [stored]);
}
