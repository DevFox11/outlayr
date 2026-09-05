import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { useLiveQuery } from "./live-query";
import { recentMerchantNotesQuery, recentMerchants } from "./merchant-history-core";

/**
 * How many remembered merchants the form offers. Two rows of pills at the
 * widths a merchant name takes; past that the row scrolls a list nobody reads
 * to the end of.
 */
const RECENT_MERCHANT_LIMIT = 6;

/**
 * The merchants this ledger has filed before on one side of it, most recent
 * first.
 *
 * Scoped to `income` for the same reason the category lookup is: the shops an
 * expense names and the payers an income names are two different lists, and
 * offering one where the other belongs is noise.
 */
export function useRecentMerchants(db: Database, income: boolean, limit: number = RECENT_MERCHANT_LIMIT): string[] {
    const rows = useLiveQuery(transactions, () => recentMerchantNotesQuery(db, income), [income]);
    return useMemo(() => recentMerchants(rows, limit), [rows, limit]);
}
