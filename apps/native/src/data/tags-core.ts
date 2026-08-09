import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { tags, transactionTags } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { findTagByName, normalizeTagName, tagLinkDiff } from "@/domain/tags";

export interface TagRow {
	color: string | null;
	id: string;
	name: string;
	sortOrder: number;
}

/**
 * Blanked the way every other tombstone here is, so a deleted tag carries no
 * name a stale device could still render.
 */
export const TOMBSTONED_TAG = {
	color: null,
	name: "",
	sortOrder: 0,
} as const;

export function liveTagsQuery(db: Database) {
	return db
		.select({
			color: tags.color,
			id: tags.id,
			name: tags.name,
			sortOrder: tags.sortOrder,
		})
		.from(tags)
		.where(isNull(tags.deletedAt));
}

/** The tag ids a transaction currently carries. */
export function tagIdsForQuery(db: Database, transactionId: string) {
	return db
		.select({ tagId: transactionTags.tagId })
		.from(transactionTags)
		.where(and(eq(transactionTags.transactionId, transactionId), isNull(transactionTags.deletedAt)));
}

export const tagsRepo = {
	/**
	 * Retires the tag and every link to it, in one transaction.
	 *
	 * The links go too because a live link to a tombstoned tag is a row that
	 * reads as tagged and renders nothing — and on another device it would
	 * resurrect the moment that device had not yet pulled the tag's tombstone.
	 */
	async deleteTag(db: Database, id: string): Promise<void> {
		const now = new Date();
		await withTransaction(db, async () => {
			await db
				.update(transactionTags)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(transactionTags.tagId, id), isNull(transactionTags.deletedAt)));
			await db
				.update(tags)
				.set({ ...TOMBSTONED_TAG, deletedAt: now, updatedAt: now })
				.where(and(eq(tags.id, id), isNull(tags.deletedAt)));
		});
	},
	/**
	 * The tag answering to `name`, creating it only if none does.
	 *
	 * Matching happens before inserting because the picker lets someone type a
	 * name they already have: without this, "Work" and "work" become two tags
	 * that look the same in every list they appear in.
	 */
	async ensureTag(db: Database, name: string): Promise<string | null> {
		const clean = normalizeTagName(name);
		if (clean === "") {
			return null;
		}
		const existing = findTagByName(await liveTagsQuery(db), clean);
		if (existing) {
			return existing.id;
		}
		const id = newId();
		await db.insert(tags).values({
			color: null,
			deletedAt: null,
			id,
			name: clean,
			sortOrder: 0,
			updatedAt: new Date(),
		});
		return id;
	},

	async renameTag(db: Database, id: string, name: string): Promise<void> {
		const clean = normalizeTagName(name);
		if (clean === "") {
			return;
		}
		await db.update(tags).set({ name: clean, updatedAt: new Date() }).where(eq(tags.id, id));
	},

	/**
	 * Makes a transaction carry exactly `tagIds`.
	 *
	 * A previously detached link is revived rather than re-inserted: the pair is
	 * unique, so a second row for it cannot exist, and reviving keeps the same
	 * identity the other devices already know.
	 */
	async setTagsFor(db: Database, transactionId: string, tagIds: readonly string[]): Promise<void> {
		const now = new Date();
		const current = (await tagIdsForQuery(db, transactionId)).map((row) => row.tagId);
		const { attach, detach } = tagLinkDiff(current, tagIds);
		if (attach.length === 0 && detach.length === 0) {
			return;
		}
		await withTransaction(db, async () => {
			if (detach.length > 0) {
				await db
					.update(transactionTags)
					.set({ deletedAt: now, updatedAt: now })
					.where(and(eq(transactionTags.transactionId, transactionId), inArray(transactionTags.tagId, [...detach])));
			}
			for (const tagId of attach) {
				const retired = await db
					.select({ id: transactionTags.id })
					.from(transactionTags)
					.where(and(eq(transactionTags.transactionId, transactionId), eq(transactionTags.tagId, tagId)))
					.limit(1);
				if (retired[0]) {
					await db
						.update(transactionTags)
						.set({ deletedAt: null, updatedAt: now })
						.where(eq(transactionTags.id, retired[0].id));
					continue;
				}
				await db.insert(transactionTags).values({
					deletedAt: null,
					id: newId(),
					tagId,
					transactionId,
					updatedAt: now,
				});
			}
		});
	},
};
