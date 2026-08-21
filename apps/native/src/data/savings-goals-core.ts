import { asc, eq, isNull, max } from "drizzle-orm";

import type { Database } from "@/db/client";
import { savingsGoals } from "@/db/schema";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";

import { localRateLookup } from "./rates";

export type SavingsGoal = typeof savingsGoals.$inferSelect;

export type SavingsGoalPatch = Partial<Omit<SavingsGoalInput, "accountId" | "currency" | "startAmount">>;

export interface SavingsGoalInput {
    accountId: string;
    currency: string;
    name: string;
    /**
     * The account's balance at the moment the goal is set, in `currency`.
     *
     * The caller supplies it because only the screen setting the goal holds a
     * valued balance; the repo would have to re-derive one and could disagree
     * with the figure the reader just saw.
     */
    startAmount: number;
    targetAmount: number;
    targetDate: Date;
}

/** Live goals in display order, newest sort first. */
export function savingsGoalsQuery(db: Database) {
    return db.select().from(savingsGoals).where(isNull(savingsGoals.deletedAt)).orderBy(asc(savingsGoals.sortOrder));
}

/**
 * A goal whose figures cannot be canonicalised to USD, and so must not be saved.
 *
 * `frozenInDisplay` reads a null `*Usd` back as the FACE value, so a goal frozen
 * without one is correct only for as long as the ledger stays in the currency it
 * was set in — and silently wrong, permanently, the day that changes. Refusing
 * is the only outcome that cannot become a lie later.
 */
export class GoalValuationError extends Error {
    constructor() {
        super("A goal's amounts could not be valued in USD.");
        this.name = "GoalValuationError";
    }
}

/** Mirrors `accounts-core`'s: a target is frozen the same way a balance is. */
async function frozenUsd(
    db: Database,
    amount: number,
    currency: string,
    date: Date
): Promise<{ amountUsd: number | null; exchangeRate: number | null }> {
    if (amount === 0) {
        return { amountUsd: 0, exchangeRate: null };
    }
    const { amountUsd, exchangeRate } = await canonicalUsd(localRateLookup(db), {
        amount: Math.abs(amount),
        currency,
        date,
        displayCurrency: currency,
    });
    return {
        amountUsd: amountUsd == null ? null : Math.sign(amount) * amountUsd,
        exchangeRate: exchangeRate ?? null,
    };
}

/**
 * A re-typed target in USD, at the rate this goal was frozen against.
 *
 * Read from the goal's own `exchangeRate` rather than looked up again, because
 * the history it came from does not survive: it is pruned to the newest row per
 * pair per calendar MONTH outside the 90-day window (`pruneStaleBatch`), and the
 * surviving row for the creation month can be dated after the goal — so a lookup
 * for `dateCreated` on an old goal falls back to the PREVIOUS month's row and
 * freezes the new target at a rate that never valued this one.
 *
 * The stored rate rather than the stored amount pair: dividing the pair recovers
 * only as much precision as those already-rounded figures kept, and scaling a
 * small target up to a large one multiplies that error with it.
 *
 * A rate stored as currency-per-USD, so USD is the amount divided by it — the
 * direction `canonicalUsd` documents.
 */
async function refrozen(db: Database, existing: SavingsGoal, amount: number): Promise<number> {
    const { currency, dateCreated, exchangeRate } = existing;
    if (currency === "USD") {
        return amount;
    }
    if (exchangeRate !== null && exchangeRate !== 0) {
        return amount / exchangeRate;
    }
    // A goal written before the rate was stored. Its own amount pair is a rounded
    // record of that rate, which is a worse basis than the rate itself but a far
    // better one than a lookup that can now resolve to a different day entirely.
    const { targetAmount, targetAmountUsd } = existing;
    if (targetAmountUsd !== null && targetAmount !== 0 && targetAmountUsd !== 0) {
        return (amount * targetAmountUsd) / targetAmount;
    }
    const { amountUsd } = await frozenUsd(db, amount, currency, dateCreated);
    if (amountUsd === null) {
        throw new GoalValuationError();
    }
    return amountUsd;
}

async function nextSortOrder(db: Database): Promise<number> {
    const [row] = await db.select({ highest: max(savingsGoals.sortOrder) }).from(savingsGoals);
    return (row?.highest ?? -1) + 1;
}

export const savingsGoalsRepo = {
    async create(db: Database, input: SavingsGoalInput): Promise<string> {
        const now = new Date();
        const id = newId();
        // Both figures, before anything is written: a balance the screen could
        // state in today's display currency is not the same thing as one that can
        // be canonicalised, and the ledger's own currency having no rate is
        // exactly the case that slips past a display-side check.
        const start = await frozenUsd(db, input.startAmount, input.currency, now);
        const target = await frozenUsd(db, input.targetAmount, input.currency, now);
        if (start.amountUsd === null || target.amountUsd === null) {
            throw new GoalValuationError();
        }
        // The target's, because a zero start never consults a rate at all.
        const exchangeRate = target.exchangeRate ?? start.exchangeRate;
        await db.insert(savingsGoals).values({
            accountId: input.accountId,
            currency: input.currency,
            dateCreated: now,
            deletedAt: null,
            exchangeRate,
            id,
            name: input.name,
            sortOrder: await nextSortOrder(db),
            startAmount: input.startAmount,
            startAmountUsd: start.amountUsd,
            targetAmount: input.targetAmount,
            // Frozen at write, like every other cross-currency figure: a target set
            // in bolivares must not silently restate itself when the rate moves.
            targetAmountUsd: target.amountUsd,
            targetDate: input.targetDate,
            updatedAt: now,
        });
        return id;
    },

    async remove(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await db.update(savingsGoals).set({ deletedAt: now, updatedAt: now }).where(eq(savingsGoals.id, id));
    },

    async update(db: Database, id: string, patch: SavingsGoalPatch): Promise<void> {
        const [existing] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
        if (existing == null) {
            throw new Error("Savings goal not found.");
        }
        const now = new Date();
        const targetAmount = patch.targetAmount ?? existing.targetAmount;
        const { currency } = existing;
        const restated = targetAmount !== existing.targetAmount;
        // Neither the currency nor the start anchor is patchable. A goal is set in
        // one currency and read back through one date; letting either move meant
        // the anchor, the frozen USD figures and the valuation date could each end
        // up describing a different moment. The sheet is opened in the goal's own
        // currency instead, so a re-typed target needs no restating.
        await db
            .update(savingsGoals)
            .set({
                ...patch,
                currency,
                targetAmount,
                // Frozen against the goal's OWN date, not today's. Every figure a goal
                // holds is read back through `dateCreated` — that is the one frame it
                // has — so freezing a re-typed target at the edit's rate would file it
                // under a day whose rate was never used to convert it.
                targetAmountUsd: restated ? await refrozen(db, existing, targetAmount) : existing.targetAmountUsd,
                updatedAt: now,
            })
            .where(eq(savingsGoals.id, id));
    },
};
