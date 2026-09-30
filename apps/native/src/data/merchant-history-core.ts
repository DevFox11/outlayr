import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { rememberedCategory } from "@/domain/merchant-history";
import type { HistoricalEntry } from "@/domain/merchant-history";
import { merchantKey } from "@/domain/merchant-resolver";

/**
 * How far back a lookup reads before giving up on remembering a merchant.
 *
 * The window is recency, not a text match: `merchantKey` folds diacritics and
 * collapses punctuation, and SQLite has no equivalent, so a `LIKE` narrowed on
 * the normalised key would silently miss every accented spelling it was meant
 * to find — "panaderia" against a stored "Panadería". Reading a bounded window
 * and comparing exactly in JS is slower in theory and correct in practice.
 *
 * A merchant absent from the last 500 filed entries on this side of the ledger
 * is not remembered. That is a deliberate bound, and it sits behind the 600ms
 * enrichment debounce.
 */
export const HISTORY_WINDOW = 500;

/**
 * The category this user has filed this merchant under before, or null.
 *
 * Scoped to `income` because a category belongs to one side of the ledger: a
 * refund from a shop the user files under an expense category must not answer
 * with it.
 */
export async function rememberedCategoryFor(db: Database, key: string, income: boolean): Promise<string | null> {
    if (key === "") {
        return null;
    }

    const rows = await db
        .select({ categoryId: transactions.categoryId, date: transactions.date, note: transactions.note })
        .from(transactions)
        .where(
            and(
                eq(transactions.income, income),
                isNotNull(transactions.categoryId),
                isNull(transactions.deletedAt),
                isNull(transactions.feeForId),
                isNull(transactions.transferId),
                ne(transactions.note, "")
            )
        )
        .orderBy(desc(transactions.date))
        .limit(HISTORY_WINDOW);

    const entries: HistoricalEntry[] = [];
    for (const row of rows) {
        if (row.categoryId == null) {
            continue;
        }
        entries.push({ categoryId: row.categoryId, date: row.date.getTime(), note: row.note });
    }
    return rememberedCategory(entries, key);
}

/**
 * How far back the remembered-merchant list reads. Shorter than
 * {@link HISTORY_WINDOW} because this one is folded down to a handful of names
 * for a pill row rather than tallied: a merchant absent from the last 200 filed
 * entries is not what the user is about to type again.
 */
export const RECENT_MERCHANT_WINDOW = 200;

export interface MerchantNoteRow {
    note: string;
}

/**
 * The named entries on one side of the ledger, most recent first.
 *
 * Kept as a builder rather than an awaited read so the same query serves both
 * the live hook and a test that runs it directly.
 */
export function recentMerchantNotesQuery(db: Database, income: boolean) {
    return db
        .select({ note: transactions.note })
        .from(transactions)
        .where(
            and(
                eq(transactions.income, income),
                isNull(transactions.deletedAt),
                isNull(transactions.feeForId),
                isNull(transactions.transferId),
                ne(transactions.note, "")
            )
        )
        .orderBy(desc(transactions.date))
        .limit(RECENT_MERCHANT_WINDOW);
}

/**
 * The distinct merchants those notes name, most recent first.
 *
 * Folded on `merchantKey` for the same reason the category lookup is: "Rio
 * Supermercado", "RIO SUPERMERCADO" and "rio  supermercado" are one merchant,
 * and SQLite cannot say so. The spelling kept is the most recent one, which is
 * the one the user last chose to write.
 */
export function recentMerchants(rows: readonly MerchantNoteRow[], limit: number): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const row of rows) {
        const key = merchantKey(row.note);
        if (key === "" || seen.has(key)) {
            continue;
        }
        seen.add(key);
        names.push(row.note.trim());
        if (names.length === limit) {
            break;
        }
    }
    return names;
}
