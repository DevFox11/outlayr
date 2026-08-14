import { and, eq, isNull } from "drizzle-orm";

import { getMeta, META_KEYS } from "@/data/app-meta-core";
import { localRateLookup } from "@/data/rates";
import { readNumberSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { budgets, mainBudget } from "@/db/schema";
import { startOfPeriod } from "@/domain/budget-math";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";
import { DEFAULT_CURRENCY } from "@/domain/money";

/**
 * The limit, plus the currency it was set in and its USD value on the day the
 * window it anchors opens. A bare number would silently become whatever the
 * ledger's currency setting says next, and freezing the USD value at the write
 * instant instead would disagree with `limitIn`, which reads the window's day.
 */
async function budgetLimit(
    db: Database,
    amount: number,
    at: Date
): Promise<{ amount: number; currency: string; amountUsd: number | null }> {
    const magnitude = Math.abs(amount);
    const currency = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
    const { amountUsd } = await canonicalUsd(localRateLookup(db), {
        amount: magnitude,
        currency,
        date: at,
        displayCurrency: currency,
    });
    return { amount: magnitude, amountUsd, currency };
}

/**
 * Route segment for the overall budget, which has no category id of its own.
 * Lives here rather than in `budgets.ts` so callers that must not pull in the
 * expo-sqlite driver — the widget/intent props builder, and anything the node
 * test runner loads — can name it.
 */
export const OVERALL_BUDGET_ID = "overall";

export interface CreateBudgetInput {
    amount: number;
    categoryId: string;
    /** Custom label; blank falls back to the category name at read time. */
    name?: string | null;
    /** Carries an unspent or overspent window into the next one. */
    rollover?: boolean;
    /** Explicit anchor; omitted anchors to the start of the current period. */
    startDate?: Date | null;
    type: number;
}

export interface CreateMainBudgetInput {
    amount: number;
    name?: string | null;
    /** Omitted leaves an existing budget's setting alone; see `upsertMainBudget`. */
    rollover?: boolean;
    startDate?: Date | null;
    type: number;
}

/** Blank names are stored as null so the views keep their own fallback label. */
function customName(name: string | null | undefined): string | null {
    const trimmed = name?.trim();
    return trimmed || null;
}

async function anchorFor(db: Database, startDate: Date | null | undefined, type: number, now: Date): Promise<Date> {
    if (startDate) {
        return startDate;
    }
    const [firstWeekday, firstDayOfMonth] = await Promise.all([
        readNumberSetting(db, "firstWeekday"),
        readNumberSetting(db, "firstDayOfMonth"),
    ]);
    return startOfPeriod(now, type, { firstDayOfMonth, firstWeekday });
}

/**
 * Both budget tables replicate, and their `AFTER DELETE` triggers drop the row's
 * outbox entry rather than queueing anything, so a hard delete would never reach
 * a peer — which would then keep the budget, stamp `updatedAt` on its own next
 * period rollover, and push the row back, undoing the delete. A tombstone keeps
 * only what replication needs (the id, `updatedAt`, `deletedAt`); `categoryId`
 * cannot be among it because it is unique on the table, and a surviving one would
 * lock the category out of ever holding a budget again. Exported because
 * `erase-core.ts` writes the same shape in bulk, and two copies would drift the
 * first time a column is added to the table.
 */
export const TOMBSTONED_BUDGET = {
    amount: 0,
    amountUsd: null,
    categoryId: null,
    currency: null,
    dateCreated: null,
    green: false,
    name: null,
    rollover: false,
    startDate: null,
    type: 0,
} as const;

export const TOMBSTONED_MAIN_BUDGET = {
    amount: 0,
    amountUsd: null,
    currency: null,
    dateCreated: null,
    green: false,
    name: null,
    rollover: false,
    startDate: null,
    type: 0,
} as const;

export const budgetsRepo = {
    /** See `advanceBudgetWindow`. */
    async advanceBudgetStart(db: Database, id: string, start: Date): Promise<void> {
        await db.update(budgets).set({ startDate: start, updatedAt: new Date() }).where(eq(budgets.id, id));
    },

    async advanceMainStart(db: Database, id: string, start: Date): Promise<void> {
        await db.update(mainBudget).set({ startDate: start, updatedAt: new Date() }).where(eq(mainBudget.id, id));
    },
    async createBudget(db: Database, input: CreateBudgetInput): Promise<string> {
        const now = new Date();
        const id = newId();
        const start = await anchorFor(db, input.startDate, input.type, now);
        await db.insert(budgets).values({
            id,
            name: customName(input.name),
            ...(await budgetLimit(db, input.amount, start)),
            categoryId: input.categoryId,
            dateCreated: now,
            deletedAt: null,
            green: false,
            rollover: input.rollover ?? false,
            startDate: start,
            type: input.type,
            updatedAt: now,
        });
        return id;
    },

    /**
     * There is only ever one overall budget, so an existing non-deleted row is
     * re-pointed instead of inserting a second.
     */
    async createMainBudget(db: Database, input: CreateMainBudgetInput): Promise<string> {
        const now = new Date();
        const existing = await db
            .select({ id: mainBudget.id })
            .from(mainBudget)
            .where(isNull(mainBudget.deletedAt))
            .limit(1);
        const start = await anchorFor(db, input.startDate, input.type, now);
        if (existing[0]) {
            await db
                .update(mainBudget)
                .set({
                    // Only write a name the caller actually supplied: the form opens on
                    // Overall with the field blank, so writing it unconditionally erases
                    // whatever the existing budget is called.
                    ...(input.name === undefined ? {} : { name: customName(input.name) }),
                    ...(await budgetLimit(db, input.amount, start)),
                    startDate: start,
                    type: input.type,
                    // Only when supplied, for the same reason `name` is guarded: the
                    // form opens on Overall without it and would otherwise turn it off.
                    ...(input.rollover === undefined ? {} : { rollover: input.rollover }),
                    updatedAt: now,
                })
                .where(eq(mainBudget.id, existing[0].id));
            return existing[0].id;
        }
        const id = newId();
        await db.insert(mainBudget).values({
            id,
            name: customName(input.name),
            ...(await budgetLimit(db, input.amount, start)),
            dateCreated: now,
            deletedAt: null,
            green: false,
            rollover: input.rollover ?? false,
            startDate: start,
            type: input.type,
            updatedAt: now,
        });
        return id;
    },

    /**
     * Tombstones rather than drops — see `TOMBSTONED_BUDGET`. An already-deleted
     * row is left alone so a repeated delete does not re-stamp a `deletedAt` and
     * push a row that has not changed.
     */
    async deleteBudget(db: Database, id: string): Promise<void> {
        const now = new Date();
        await db
            .update(budgets)
            .set({ ...TOMBSTONED_BUDGET, deletedAt: now, updatedAt: now })
            .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)));
    },

    async deleteMainBudget(db: Database, id: string): Promise<void> {
        const now = new Date();
        await db
            .update(mainBudget)
            .set({ ...TOMBSTONED_MAIN_BUDGET, deletedAt: now, updatedAt: now })
            .where(and(eq(mainBudget.id, id), isNull(mainBudget.deletedAt)));
    },

    async updateBudget(db: Database, id: string, input: CreateBudgetInput): Promise<void> {
        const now = new Date();
        const start = await anchorFor(db, input.startDate, input.type, now);
        await db
            .update(budgets)
            .set({
                name: customName(input.name),
                ...(await budgetLimit(db, input.amount, start)),
                categoryId: input.categoryId,
                rollover: input.rollover ?? false,
                startDate: start,
                type: input.type,
                updatedAt: now,
            })
            .where(eq(budgets.id, id));
    },
};

/**
 * Synchronous on purpose: the expo-sqlite driver executes on the JS thread, so
 * the edit form can have the row in hand during its first render instead of
 * flashing an empty one for a frame.
 */
export function getBudgetById(db: Database, id: string): typeof budgets.$inferSelect | null {
    const rows = db
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
        .limit(1)
        .all();
    return rows[0] ?? null;
}
