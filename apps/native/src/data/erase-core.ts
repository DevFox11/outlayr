import { isNull } from "drizzle-orm";
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
 * A tombstone exists to be replicated, so it keeps exactly what replication
 * needs — the row's id, `deletedAt`, and the `updatedAt` that orders it against
 * a peer's edit — and nothing that made the row the user's. Not-null columns
 * take a neutral value because the column cannot hold one; no reader ever sees
 * them, since every read filters `isNull(deletedAt)`.
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
	date: new Date(0),
	day: new Date(0),
	month: new Date(0),
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
	reminderLeadDays: null,
	categoryId: null,
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
 * `categoryId` is dropped rather than kept for lineage because it is unique on
 * the table: a surviving one would lock the category out of ever holding a
 * budget again.
 */
const ERASED_BUDGET = {
	name: null,
	amount: 0,
	type: 0,
	startDate: null,
	dateCreated: null,
	currency: null,
	amountUsd: null,
	green: false,
	categoryId: null,
} as const;

const ERASED_MAIN_BUDGET = {
	name: null,
	amount: 0,
	type: 0,
	startDate: null,
	dateCreated: null,
	currency: null,
	amountUsd: null,
	green: false,
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
			.set({ ...ERASED_BUDGET, updatedAt: now, deletedAt: now })
			.where(isNull(budgets.deletedAt));
		await db
			.update(mainBudget)
			.set({ ...ERASED_MAIN_BUDGET, updatedAt: now, deletedAt: now })
			.where(isNull(mainBudget.deletedAt));
	});
}
