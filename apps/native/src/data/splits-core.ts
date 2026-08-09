import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { transactionSplits } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { type Allocation, isBalanced } from "@/domain/split";

/**
 * Raised rather than silently written, because an unbalanced split is a
 * contradiction the user can see: the row states one amount and the parts
 * underneath it state another, and every category total downstream inherits it.
 */
export class UnbalancedSplitError extends Error {
	constructor(total: number, allocated: number) {
		super(`Split allocates ${allocated} of ${total}`);
		this.name = "UnbalancedSplitError";
	}
}

export function splitsForQuery(db: Database, transactionId: string) {
	return db
		.select({
			amount: transactionSplits.amount,
			categoryId: transactionSplits.categoryId,
			id: transactionSplits.id,
		})
		.from(transactionSplits)
		.where(and(eq(transactionSplits.transactionId, transactionId), isNull(transactionSplits.deletedAt)))
		.orderBy(asc(transactionSplits.sortOrder));
}

/** Every live split in the ledger, for the readers that aggregate by category. */
export function allSplitsQuery(db: Database) {
	return db
		.select({
			amount: transactionSplits.amount,
			categoryId: transactionSplits.categoryId,
			transactionId: transactionSplits.transactionId,
		})
		.from(transactionSplits)
		.where(isNull(transactionSplits.deletedAt))
		.orderBy(asc(transactionSplits.sortOrder));
}

export const splitsRepo = {
	/**
	 * Retires the splits of entries that are going.
	 *
	 * A live split pointing at a tombstoned entry would keep contributing to its
	 * categories forever — the entry is gone from every list, and its parts are
	 * not.
	 */
	async clearForTransactions(db: Database, transactionIds: readonly string[]): Promise<void> {
		if (transactionIds.length === 0) {
			return;
		}
		const now = new Date();
		await db
			.update(transactionSplits)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(inArray(transactionSplits.transactionId, [...transactionIds]), isNull(transactionSplits.deletedAt)));
	},
	/**
	 * Replaces an entry's split with `allocations`, or clears it when given none.
	 *
	 * Rows are rewritten wholesale rather than diffed, unlike tags. A split's
	 * parts have no identity worth preserving — they are positions in a list, and
	 * an allocation that changed both its category and its amount is not the same
	 * allocation. Tombstoning and re-inserting says exactly that.
	 *
	 * Clearing is how an entry goes back to being attributed by its own
	 * `categoryId`: no rows is the implicit whole, not "attributed to nothing".
	 */
	async setSplit(
		db: Database,
		transactionId: string,
		total: number,
		allocations: readonly Allocation[]
	): Promise<void> {
		if (allocations.length > 0 && !isBalanced(total, allocations)) {
			const allocated = allocations.reduce((sum, one) => sum + one.amount, 0);
			throw new UnbalancedSplitError(total, allocated);
		}
		const now = new Date();
		await withTransaction(db, async () => {
			await db
				.update(transactionSplits)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(transactionSplits.transactionId, transactionId), isNull(transactionSplits.deletedAt)));
			if (allocations.length === 0) {
				return;
			}
			await db.insert(transactionSplits).values(
				allocations.map((allocation, index) => ({
					amount: allocation.amount,
					categoryId: allocation.categoryId,
					deletedAt: null,
					id: newId(),
					sortOrder: index,
					transactionId,
					updatedAt: now,
				}))
			);
		});
	},
};
