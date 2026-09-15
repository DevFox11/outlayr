import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions, transactionTags } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { merchantKey } from "@/domain/merchant-resolver";

import { forgetLogoDismissal, refreshLogoCandidate } from "./logo-backfill-state";

/**
 * How far back the sibling search reads. The same bound and the same reason
 * as `merchant-history-core.ts`: `merchantKey` folds diacritics, SQLite
 * cannot, so the match is made in JS over a recency window.
 */
const SIBLING_WINDOW = 500;

export interface MerchantSiblingsInput {
    /** The category the looked-up row was saved with; fills siblings that have none. */
    categoryId: string | null;
    /**
     * The looked-up row's own currency column: null when it is in the ledger's
     * default currency. A sibling in the same currency may store it either way
     * — null, or the code written out — so both spellings are matched.
     */
    currency: string | null;
    defaultCurrency: string;
    /** Removes a file a sibling did not take after all. */
    discard?: (imageUri: string) => void;
    /** The row the lookup was made on. It already carries the answer. */
    excludeId: string;
    income: boolean;
    key: string;
    /**
     * Produces one stored file per row, as the backfill does: a photo is owned
     * by the row that names it, so deleting one row never orphans another's
     * image. Null when the lookup found no logo.
     */
    persistLogo: (() => Promise<{ imageColor: string | null; imageUri: string }>) | null;
    /** Attached to siblings that carry no tags of their own. */
    tagIds: readonly string[];
}

interface SiblingPatch {
    categoryId?: string;
    imageColor?: string | null;
    imageUri?: string;
}

/**
 * Carries a merchant lookup the user asked for on one row over to every other
 * row of the same merchant and currency.
 *
 * The carry runs in the background while the ledger stays live, so a sibling
 * is written only if it is still the row that was selected: the UPDATE
 * carries the stamp and the columns the decision was made on, and a row that
 * moved under it — an edit here, a peer's by sync — keeps its newer state
 * and the file persisted for it is discarded.
 *
 * The logo replaces whatever image a sibling had, but never an emoji, a glyph
 * or a tint: those three can only be a choice, while an image is most often
 * a logo the earlier lookup got wrong. A dismissal recorded for a repainted
 * row is released, because the user just asked for this exact image. The
 * category and tags only fill rows that have none — a sibling filed by hand
 * keeps its filing, which is also what history answers with next time.
 *
 * `imageKey` is left standing on a repainted row, as the form does for a
 * replaced photo: the uploader reads it to release the superseded object.
 */
export async function applyMerchantToSiblings(db: Database, input: MerchantSiblingsInput): Promise<number> {
    const effective = input.currency ?? input.defaultCurrency;
    const sameCurrency =
        effective === input.defaultCurrency
            ? or(isNull(transactions.currency), eq(transactions.currency, effective))
            : eq(transactions.currency, effective);
    const recent = await db
        .select({
            categoryId: transactions.categoryId,
            customColor: transactions.customColor,
            emoji: transactions.emoji,
            icon: transactions.icon,
            id: transactions.id,
            income: transactions.income,
            note: transactions.note,
            updatedAt: transactions.updatedAt,
        })
        .from(transactions)
        .where(
            and(
                isNull(transactions.deletedAt),
                ne(transactions.note, ""),
                ne(transactions.id, input.excludeId),
                sameCurrency
            )
        )
        .orderBy(desc(transactions.date))
        .limit(SIBLING_WINDOW);
    const siblings = recent.filter((row) => merchantKey(row.note) === input.key);

    let touched = 0;
    /* oxlint-disable no-await-in-loop -- each row persists its own logo file and the connection is shared, so the rows go one at a time */
    for (const row of siblings) {
        const patch: SiblingPatch = {};
        if (input.categoryId != null && row.categoryId == null && row.income === input.income) {
            patch.categoryId = input.categoryId;
        }
        const chosenIdentity = row.emoji != null || row.icon != null || row.customColor != null;
        if (input.persistLogo != null && !chosenIdentity) {
            let logo: { imageColor: string | null; imageUri: string } | null = null;
            try {
                logo = await input.persistLogo();
            } catch {
                logo = null;
            }
            if (logo != null) {
                patch.imageUri = logo.imageUri;
                patch.imageColor = logo.imageColor;
                await forgetLogoDismissal(db, row.id);
            }
        }
        // The row is written only if it is still the one selected: the stamp
        // and the columns the decision was made on are in the predicate.
        const still = [
            eq(transactions.id, row.id),
            eq(transactions.updatedAt, row.updatedAt),
            eq(transactions.note, row.note),
        ];
        if (patch.categoryId != null) {
            still.push(isNull(transactions.categoryId));
        }
        if (patch.imageUri != null) {
            still.push(isNull(transactions.emoji), isNull(transactions.icon), isNull(transactions.customColor));
        }
        const nextStamp = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
        let liveStamp = row.updatedAt;
        let wrote = false;
        if (Object.keys(patch).length > 0) {
            if (patch.imageUri == null) {
                // A category alone leaves the row bare, and the backfill only
                // paints a candidate whose stamp still matches the row: the
                // stamp follows the write, as an edit's does. Before the write,
                // since the refresh matches against the row as it is now.
                await refreshLogoCandidate(db, row.id, nextStamp.getTime());
            }
            const written = await db
                .update(transactions)
                .set({
                    ...patch,
                    // Never behind the row's own clock, or the sync's last-writer
                    // check drops the paint.
                    updatedAt: nextStamp,
                })
                .where(and(...still))
                .returning({ id: transactions.id });
            if (written.length === 0) {
                if (patch.imageUri != null) {
                    input.discard?.(patch.imageUri);
                }
                continue;
            }
            liveStamp = nextStamp;
            wrote = true;
        }
        if (input.tagIds.length > 0) {
            wrote = (await attachTagsIfStill(db, row.id, row.note, liveStamp, input.tagIds)) || wrote;
        }
        if (wrote) {
            touched += 1;
        }
    }
    /* oxlint-enable no-await-in-loop */
    return touched;
}

async function attachTagsIfStill(
    db: Database,
    transactionId: string,
    note: string,
    stamp: Date,
    tagIds: readonly string[]
): Promise<boolean> {
    const now = new Date();
    let wrote = false;
    await withTransaction(db, async () => {
        const still = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
                and(eq(transactions.id, transactionId), eq(transactions.note, note), eq(transactions.updatedAt, stamp))
            )
            .limit(1);
        if (still.length === 0) {
            return;
        }
        const own = await db
            .select({ id: transactionTags.id })
            .from(transactionTags)
            .where(and(eq(transactionTags.transactionId, transactionId), isNull(transactionTags.deletedAt)))
            .limit(1);
        if (own.length > 0) {
            return;
        }
        const retired = await db
            .select({ id: transactionTags.id, tagId: transactionTags.tagId })
            .from(transactionTags)
            .where(and(eq(transactionTags.transactionId, transactionId), inArray(transactionTags.tagId, [...tagIds])));
        const revivable = new Map(retired.map((row) => [row.tagId, row.id]));
        /* oxlint-disable no-await-in-loop -- expo-sqlite's withTransactionAsync shares one connection, so statements issued concurrently inside the callback interleave with the transaction boundary */
        for (const tagId of tagIds) {
            const revived = revivable.get(tagId);
            if (revived === undefined) {
                await db.insert(transactionTags).values({
                    deletedAt: null,
                    id: newId(),
                    tagId,
                    transactionId,
                    updatedAt: now,
                });
                continue;
            }
            await db
                .update(transactionTags)
                .set({ deletedAt: null, updatedAt: now })
                .where(eq(transactionTags.id, revived));
        }
        wrote = tagIds.length > 0;
    });
    return wrote;
}
