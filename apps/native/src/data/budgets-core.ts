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
    at: Date,
    /**
     * The currency `amount` is already denominated in. Passed when the number is
     * the one the row already holds — re-anchoring must not re-read it as today's
     * ledger currency, which would turn a EUR 100 budget into a USD 100 one
     * without the figure on screen ever changing.
     */
    storedCurrency?: string | null
): Promise<{ amount: number; currency: string; amountUsd: number | null }> {
    const magnitude = Math.abs(amount);
    const currency = storedCurrency ?? (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
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

/**
 * One fact of a budget, changed on its own.
 *
 * Every field is optional and an omitted one is left alone, because the editor
 * commits a single row at a time: the limit sheet writes `amount` and must not
 * decide anything about `rollover`, and the name field must not restate the
 * limit. Passing a whole record instead is what let the old form silently clear
 * a name and turn carry-over off on every save.
 */
export interface PatchBudgetInput {
    amount?: number;
    name?: string | null;
    rollover?: boolean;
    startDate?: Date | null;
    type?: number;
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
                // `name` and `rollover` pass `undefined` through when the caller
                // omitted them, and drizzle's `.set()` drops an undefined value
                // rather than writing NULL — so the column keeps what it had. Both
                // need that: the form opens on Overall with the name field blank
                // and no rollover, and writing either unconditionally would erase
                // the budget's name and turn its rollover off.
                .set({
                    name: input.name === undefined ? undefined : customName(input.name),
                    ...(await budgetLimit(db, input.amount, start)),
                    rollover: input.rollover,
                    startDate: start,
                    type: input.type,
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

    /** See {@link PatchBudgetInput}. A budget that is gone is left alone. */
    async patchBudget(db: Database, id: string, input: PatchBudgetInput): Promise<void> {
        const now = new Date();
        const rows = await db
            .select({
                amount: budgets.amount,
                currency: budgets.currency,
                startDate: budgets.startDate,
                type: budgets.type,
            })
            .from(budgets)
            .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
            .limit(1);
        const [row] = rows;
        if (!row) {
            return;
        }
        await db
            .update(budgets)
            .set(await budgetPatch(db, row, input, now))
            .where(eq(budgets.id, id));
    },

    /**
     * See {@link PatchBudgetInput}.
     *
     * The overall budget had no field-level write at all: the only way in was
     * `createMainBudget`, which preserves `name` and `rollover` only when the
     * caller passes `undefined` — something the old form never did.
     */
    async patchMainBudget(db: Database, id: string, input: PatchBudgetInput): Promise<void> {
        const now = new Date();
        const rows = await db
            .select({
                amount: mainBudget.amount,
                currency: mainBudget.currency,
                startDate: mainBudget.startDate,
                type: mainBudget.type,
            })
            .from(mainBudget)
            .where(and(eq(mainBudget.id, id), isNull(mainBudget.deletedAt)))
            .limit(1);
        const [row] = rows;
        if (!row) {
            return;
        }
        await db
            .update(mainBudget)
            .set(await budgetPatch(db, row, input, now))
            .where(eq(mainBudget.id, id));
    },
};

/** The columns one changed fact writes. Shared by both budget tables. */
interface BudgetPatch {
    amount?: number;
    amountUsd?: number | null;
    currency?: string;
    name?: string | null;
    rollover?: boolean;
    startDate?: Date;
    type?: number;
    updatedAt: Date;
}

/**
 * Turns one changed fact into the columns it touches, and only those.
 *
 * `startDate` and `type` are written together, and re-freeze the limit's USD
 * value with them: that value is read against the day the window opens
 * (see {@link budgetLimit}), so an anchor that moves under an unchanged number
 * would leave the two disagreeing.
 */
async function budgetPatch(
    db: Database,
    row: { amount: number; currency: string | null; startDate: Date | null; type: number },
    input: PatchBudgetInput,
    now: Date
): Promise<BudgetPatch> {
    const type = input.type ?? row.type;
    // A cadence *change* re-anchors to the current window of the new cadence
    // unless the caller named a date: keeping the old anchor leaves a monthly
    // budget running the 15th to the 14th after a detour through Week, a cycle
    // nobody chose. A cadence merely restated is not a change — the limit sheet
    // sends the type it opened on whether or not it was touched, and re-anchoring
    // on that would quietly throw away a start date the user set by hand.
    const cadenceChanged = input.type !== undefined && input.type !== row.type;
    const anchor = await anchorFor(db, input.startDate ?? (cadenceChanged ? null : row.startDate), type, now);
    const patch: BudgetPatch = { updatedAt: now };
    const reAnchored = cadenceChanged || input.startDate !== undefined;

    if (reAnchored) {
        patch.startDate = anchor;
        patch.type = type;
    }
    if (input.amount !== undefined) {
        Object.assign(patch, await budgetLimit(db, input.amount, anchor));
    } else if (reAnchored) {
        // Only the window moved. The limit is the same money in the same currency;
        // what has to be re-read is the USD value frozen against the day the
        // window opens.
        Object.assign(patch, await budgetLimit(db, row.amount, anchor, row.currency));
    }
    if (input.name !== undefined) {
        patch.name = customName(input.name);
    }
    if (input.rollover !== undefined) {
        patch.rollover = input.rollover;
    }
    return patch;
}

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
