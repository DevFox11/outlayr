import { eq, isNull } from "drizzle-orm";
import { getMeta, META_KEYS } from "@/data/app-meta-core";
import { localRateLookup } from "@/data/rates";
import type { Database } from "@/db/client";
import { budgets, mainBudget } from "@/db/schema";
import { startOfPeriod } from "@/domain/budget-math";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";
import { DEFAULT_CURRENCY } from "@/domain/money";

/**
 * The limit, plus the currency it was set in and its USD value at that moment.
 * A bare number would silently become whatever the ledger's currency setting
 * says next.
 */
async function budgetLimit(
	db: Database,
	amount: number,
	at: Date,
): Promise<{ amount: number; currency: string; amountUsd: number | null }> {
	const magnitude = Math.abs(amount);
	const currency = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
	const { amountUsd } = await canonicalUsd(localRateLookup(db), {
		amount: magnitude,
		currency,
		displayCurrency: currency,
		date: at,
	});
	return { amount: magnitude, currency, amountUsd };
}

/**
 * Route segment for the overall budget, which has no category id of its own.
 * Lives here rather than in `budgets.ts` so callers that must not pull in the
 * expo-sqlite driver — the widget/intent props builder, and anything the node
 * test runner loads — can name it.
 */
export const OVERALL_BUDGET_ID = "overall";

export interface CreateBudgetInput {
	categoryId: string;
	amount: number;
	type: number;
	/** Custom label; blank falls back to the category name at read time. */
	name?: string | null;
	/** Explicit anchor; omitted anchors to the start of the current period. */
	startDate?: Date | null;
}

export interface CreateMainBudgetInput {
	amount: number;
	type: number;
	name?: string | null;
	startDate?: Date | null;
}

/** Blank names are stored as null so the views keep their own fallback label. */
function customName(name: string | null | undefined): string | null {
	const trimmed = name?.trim();
	return trimmed ? trimmed : null;
}

function anchorFor(
	startDate: Date | null | undefined,
	type: number,
	now: Date,
): Date {
	return startDate ?? startOfPeriod(now, type);
}

export const budgetsRepo = {
	async createBudget(db: Database, input: CreateBudgetInput): Promise<string> {
		const now = new Date();
		const id = newId();
		await db.insert(budgets).values({
			id,
			name: customName(input.name),
			...(await budgetLimit(db, input.amount, now)),
			type: input.type,
			categoryId: input.categoryId,
			startDate: anchorFor(input.startDate, input.type, now),
			dateCreated: now,
			green: false,
			updatedAt: now,
			deletedAt: null,
		});
		return id;
	},

	/**
	 * There is only ever one overall budget, so an existing non-deleted row is
	 * re-pointed instead of inserting a second.
	 */
	async createMainBudget(
		db: Database,
		input: CreateMainBudgetInput,
	): Promise<string> {
		const now = new Date();
		const existing = await db
			.select({ id: mainBudget.id })
			.from(mainBudget)
			.where(isNull(mainBudget.deletedAt))
			.limit(1);
		const start = anchorFor(input.startDate, input.type, now);
		if (existing[0]) {
			await db
				.update(mainBudget)
				.set({
					// Only write a name the caller actually supplied: the form opens on
					// Overall with the field blank, so writing it unconditionally erases
					// whatever the existing budget is called.
					...(input.name === undefined ? {} : { name: customName(input.name) }),
					...(await budgetLimit(db, input.amount, now)),
					type: input.type,
					startDate: start,
					updatedAt: now,
				})
				.where(eq(mainBudget.id, existing[0].id));
			return existing[0].id;
		}
		const id = newId();
		await db.insert(mainBudget).values({
			id,
			name: customName(input.name),
			...(await budgetLimit(db, input.amount, now)),
			type: input.type,
			startDate: start,
			dateCreated: now,
			green: false,
			updatedAt: now,
			deletedAt: null,
		});
		return id;
	},

	async updateBudget(
		db: Database,
		id: string,
		input: CreateBudgetInput,
	): Promise<void> {
		const now = new Date();
		await db
			.update(budgets)
			.set({
				name: customName(input.name),
				...(await budgetLimit(db, input.amount, now)),
				type: input.type,
				categoryId: input.categoryId,
				startDate: anchorFor(input.startDate, input.type, now),
				updatedAt: now,
			})
			.where(eq(budgets.id, id));
	},

	/** Hard-deletes: the row is small and unsynced. */
	async deleteBudget(db: Database, id: string): Promise<void> {
		await db.delete(budgets).where(eq(budgets.id, id));
	},

	async deleteMainBudget(db: Database, id: string): Promise<void> {
		await db.delete(mainBudget).where(eq(mainBudget.id, id));
	},

	/** See `advanceBudgetWindow`. */
	async advanceBudgetStart(
		db: Database,
		id: string,
		start: Date,
	): Promise<void> {
		await db
			.update(budgets)
			.set({ startDate: start, updatedAt: new Date() })
			.where(eq(budgets.id, id));
	},

	async advanceMainStart(db: Database, id: string, start: Date): Promise<void> {
		await db
			.update(mainBudget)
			.set({ startDate: start, updatedAt: new Date() })
			.where(eq(mainBudget.id, id));
	},
};
