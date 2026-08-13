import { asc, eq, isNull, max } from "drizzle-orm";
import type { Database } from "@/db/client";
import { savingsGoals } from "@/db/schema";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";
import { localRateLookup } from "./rates";

export type SavingsGoal = typeof savingsGoals.$inferSelect;

export interface SavingsGoalInput {
	accountId: string;
	currency: string;
	name: string;
	targetAmount: number;
	targetDate?: Date | null;
}

/** Live goals in display order, newest sort first. */
export function savingsGoalsQuery(db: Database) {
	return db.select().from(savingsGoals).where(isNull(savingsGoals.deletedAt)).orderBy(asc(savingsGoals.sortOrder));
}

/** Mirrors `accounts-core`'s: a target is frozen the same way a balance is. */
async function frozenUsd(db: Database, amount: number, currency: string, date: Date): Promise<number | null> {
	if (amount === 0) {
		return 0;
	}
	const { amountUsd } = await canonicalUsd(localRateLookup(db), {
		amount: Math.abs(amount),
		currency,
		date,
		displayCurrency: currency,
	});
	return amountUsd == null ? null : Math.sign(amount) * amountUsd;
}

async function nextSortOrder(db: Database): Promise<number> {
	const [row] = await db.select({ highest: max(savingsGoals.sortOrder) }).from(savingsGoals);
	return (row?.highest ?? -1) + 1;
}

export const savingsGoalsRepo = {
	async create(db: Database, input: SavingsGoalInput): Promise<string> {
		const now = new Date();
		const id = newId();
		await db.insert(savingsGoals).values({
			accountId: input.accountId,
			currency: input.currency,
			dateCreated: now,
			deletedAt: null,
			id,
			name: input.name,
			sortOrder: await nextSortOrder(db),
			targetAmount: input.targetAmount,
			// Frozen at write, like every other cross-currency figure: a target set
			// in bolivares must not silently restate itself when the rate moves.
			targetAmountUsd: await frozenUsd(db, input.targetAmount, input.currency, now),
			targetDate: input.targetDate ?? null,
			updatedAt: now,
		});
		return id;
	},

	async remove(db: Database, id: string, now: Date = new Date()): Promise<void> {
		await db.update(savingsGoals).set({ deletedAt: now, updatedAt: now }).where(eq(savingsGoals.id, id));
	},

	async update(db: Database, id: string, patch: Partial<SavingsGoalInput>): Promise<void> {
		const [existing] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
		if (existing == null) {
			throw new Error("Savings goal not found.");
		}
		const now = new Date();
		const targetAmount = patch.targetAmount ?? existing.targetAmount;
		const currency = patch.currency ?? existing.currency;
		const restated = targetAmount !== existing.targetAmount || currency !== existing.currency;
		await db
			.update(savingsGoals)
			.set({
				...patch,
				currency,
				targetAmount,
				targetAmountUsd: restated ? await frozenUsd(db, targetAmount, currency, now) : existing.targetAmountUsd,
				updatedAt: now,
			})
			.where(eq(savingsGoals.id, id));
	},
};
