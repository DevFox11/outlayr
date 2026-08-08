import { isNull } from "drizzle-orm";
import { TOMBSTONED_BUDGET, TOMBSTONED_MAIN_BUDGET } from "@/data/budgets-core";
import type { Database } from "@/db/client";
import {
	budgets,
	mainBudget,
	templateTransactions,
	transactions,
} from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { RECURRING_TYPE } from "@/domain/recurrence";

export type EraseScope = "transactions" | "everything";

/**
 * The date every erased row is stamped with, and the one thing on a scrubbed
 * tombstone that still identifies it as one: `deletedTransactionsQuery` reads
 * tombstones on purpose, so it needs a way to tell a single deleted entry the
 * user may want back from the wreckage of an erase they asked for.
 */
export const ERASED_DATE = new Date(0);

/**
 * A tombstone exists to be replicated, so it keeps exactly what replication
 * needs — the row's id, `deletedAt`, and the `updatedAt` that orders it against
 * a peer's edit — and nothing that made the row the user's. Not-null columns
 * take a neutral value because the column cannot hold one; the only read that
 * sees them is Recently Deleted, which excludes them by {@link ERASED_DATE}.
 *
 * The schedule is retired to `none` so `repairOrphanedRecurrence` cannot mistake
 * an erased row for a subscription whose carrier was deleted and mint a
 * successor out of it.
 *
 * Exported for the test that holds it against the table's columns: a column added
 * to `transactions` and not to this constant would keep its value on a tombstone,
 * which is exactly the failure this constant exists to prevent.
 */
export const ERASED_TRANSACTION = {
	amount: 0,
	income: false,
	currency: null,
	note: "",
	details: null,
	date: ERASED_DATE,
	day: ERASED_DATE,
	month: ERASED_DATE,
	icon: null,
	emoji: null,
	customColor: null,
	imageColor: null,
	imageUri: null,
	imageKey: null,
	onceRecurring: false,
	recurringType: RECURRING_TYPE.none,
	recurringCoefficient: 1,
	recurringEndDate: null,
	recurringAnchorDay: null,
	reminderLeadDays: null,
	categoryId: null,
	accountId: null,
	amountUsd: null,
	exchangeRate: null,
	exchangeRateType: null,
} as const;

const ERASED_TEMPLATE = {
	amount: 0,
	income: false,
	note: null,
	sortOrder: 0,
	recurringType: RECURRING_TYPE.none,
	recurringCoefficient: 1,
	categoryId: null,
} as const;

/**
 * Categories survive both scopes — erasing those lives on the Categories screen.
 *
 * Rows are tombstoned, not dropped: a hard delete leaves nothing to replicate,
 * so the first pull after an erase would hand the whole ledger back.
 * Already-tombstoned rows are skipped so a second erase neither re-stamps a
 * `deletedAt` the user never asked for again nor pushes a row that has not
 * changed.
 */
export async function eraseLedger(
	db: Database,
	scope: EraseScope,
): Promise<void> {
	const now = new Date();

	await withTransaction(db, async () => {
		await db
			.update(transactions)
			.set({ ...ERASED_TRANSACTION, updatedAt: now, deletedAt: now })
			.where(isNull(transactions.deletedAt));
		await db
			.update(templateTransactions)
			.set({ ...ERASED_TEMPLATE, updatedAt: now, deletedAt: now })
			.where(isNull(templateTransactions.deletedAt));

		if (scope !== "everything") {
			return;
		}
		await db
			.update(budgets)
			.set({ ...TOMBSTONED_BUDGET, updatedAt: now, deletedAt: now })
			.where(isNull(budgets.deletedAt));
		await db
			.update(mainBudget)
			.set({ ...TOMBSTONED_MAIN_BUDGET, updatedAt: now, deletedAt: now })
			.where(isNull(mainBudget.deletedAt));
	});
}
