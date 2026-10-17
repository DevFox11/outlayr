import { beforeEach, describe, expect, it } from "@jest/globals";
import { BUDGET_TYPE, shiftWindow, startOfPeriod } from "@outlayr/money/budget-window";
import { buildRateTable, limitIn } from "@outlayr/money/valuation";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { appMeta, budgets, categories, exchangeRates, mainBudget, outbox } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";

import { budgetsRepo, TOMBSTONED_BUDGET, TOMBSTONED_MAIN_BUDGET } from "./budgets-core";
import { setSyncEnabled } from "./sync-outbox-core";

function getBudgetById(db: Database, id: string) {
    return (
        db
            .select()
            .from(budgets)
            .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
            .limit(1)
            .all()[0] ?? null
    );
}

const makeDb = () => migratedDatabase({ foreignKeys: false });

async function queued(db: Database): Promise<[string, string][]> {
    const rows = await db.select({ localId: outbox.localId, tableName: outbox.tableName }).from(outbox);
    return rows.map((row) => [row.tableName, row.localId]);
}

const BACKDATE = new Date(2026, 1, 9, 14, 30, 0, 0);

describe("budgetsRepo.createBudget", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("persists a passed start date verbatim", async () => {
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });
        const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("anchors an omitted start date to the period start", async () => {
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });
        const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
        expect(row?.startDate?.getTime()).toBe(startOfPeriod(new Date(), BUDGET_TYPE.month).getTime());
    });

    it("anchors an omitted start date to the user's own week", async () => {
        await db.insert(appMeta).values({ key: "firstWeekday", value: "2" });
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            type: BUDGET_TYPE.week,
        });
        const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
        expect(row?.startDate?.getTime()).toBe(
            startOfPeriod(new Date(), BUDGET_TYPE.week, {
                firstDayOfMonth: 1,
                firstWeekday: 2,
            }).getTime()
        );
    });

    it("anchors an omitted start date to the user's own month", async () => {
        await db.insert(appMeta).values({ key: "firstDayOfMonth", value: "25" });
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });
        const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
        expect(row?.startDate?.getTime()).toBe(
            startOfPeriod(new Date(), BUDGET_TYPE.month, {
                firstDayOfMonth: 25,
                firstWeekday: 1,
            }).getTime()
        );
    });

    it("stores a trimmed custom name and nulls a blank one", async () => {
        const named = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            name: "  Coffee run  ",
            type: BUDGET_TYPE.month,
        });
        const blank = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-2",
            name: "   ",
            type: BUDGET_TYPE.month,
        });
        const rows = await db.select().from(budgets);
        expect(rows.find((r) => r.id === named)?.name).toBe("Coffee run");
        expect(rows.find((r) => r.id === blank)?.name).toBeNull();
    });
});

describe("budgetsRepo.createMainBudget", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("persists a passed start date verbatim", async () => {
        const id = await budgetsRepo.createMainBudget(db, {
            amount: 1000,
            startDate: BACKDATE,
            type: BUDGET_TYPE.week,
        });
        const [row] = await db.select().from(mainBudget).where(eq(mainBudget.id, id));
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("anchors an omitted start date to the period start", async () => {
        const id = await budgetsRepo.createMainBudget(db, {
            amount: 1000,
            type: BUDGET_TYPE.week,
        });
        const [row] = await db.select().from(mainBudget).where(eq(mainBudget.id, id));
        expect(row?.startDate?.getTime()).toBe(startOfPeriod(new Date(), BUDGET_TYPE.week).getTime());
    });

    it("anchors first-run's exact call shape to the 1st of the month", async () => {
        const id = await budgetsRepo.createMainBudget(db, {
            amount: 2400,
            startDate: null,
            type: BUDGET_TYPE.month,
        });
        const [row] = await db.select().from(mainBudget).where(eq(mainBudget.id, id));
        expect(row?.startDate?.getTime()).toBe(
            startOfPeriod(new Date(), BUDGET_TYPE.month, {
                firstDayOfMonth: 1,
                firstWeekday: 1,
            }).getTime()
        );
    });

    it("re-points the singleton rather than inserting a second", async () => {
        const first = await budgetsRepo.createMainBudget(db, {
            amount: 1000,
            name: "Everything",
            type: BUDGET_TYPE.month,
        });
        const second = await budgetsRepo.createMainBudget(db, {
            amount: 1200,
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });
        const rows = await db.select().from(mainBudget);
        expect(second).toBe(first);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.amount).toBe(1200);
        expect(rows[0]?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("keeps an existing name when the caller supplies none", async () => {
        // The form opens on Overall with the name field blank, so a re-save must
        // not silently erase what the budget was already called.
        await budgetsRepo.createMainBudget(db, {
            amount: 1000,
            name: "Household",
            type: BUDGET_TYPE.month,
        });
        await budgetsRepo.createMainBudget(db, {
            amount: 3500,
            type: BUDGET_TYPE.month,
        });
        const rows = await db.select().from(mainBudget);
        expect(rows[0]?.name).toBe("Household");
    });

    it("clears the name when the caller explicitly blanks it", async () => {
        await budgetsRepo.createMainBudget(db, {
            amount: 1000,
            name: "Household",
            type: BUDGET_TYPE.month,
        });
        await budgetsRepo.createMainBudget(db, {
            amount: 3500,
            name: "   ",
            type: BUDGET_TYPE.month,
        });
        const rows = await db.select().from(mainBudget);
        expect(rows[0]?.name).toBeNull();
    });
});

describe("budgetsRepo.patchBudget", () => {
    it("changes the limit and leaves the anchor where it was", async () => {
        // The whole point of editing rather than delete-and-recreate: a mistyped
        // target must not cost the user the window the budget has been running in.
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchBudget(db, id, { amount: 300 });

        const row = getBudgetById(db, id);
        expect(row?.amount).toBe(300);
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("leaves every fact the caller did not name", async () => {
        // The defect this replaced: the old form passed a whole record on every
        // save, so changing the limit cleared the name and turned carry-over off.
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            name: "Coffee run",
            rollover: true,
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchBudget(db, id, { amount: 300 });

        const row = getBudgetById(db, id);
        expect(row?.name).toBe("Coffee run");
        expect(row?.rollover).toBe(true);
    });

    it("writes an explicit anchor, and re-freezes the limit against it", async () => {
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: 0,
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });
        const id = await budgetsRepo.createBudget(db, {
            amount: 450,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchBudget(db, id, { startDate: BACKDATE });

        const row = getBudgetById(db, id);
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
        // Unchanged in the ledger's own currency, and re-stamped in USD against
        // the day the moved window opens.
        expect(row?.amount).toBe(450);
        expect(row?.amountUsd).toBe(500);
    });

    it("re-anchors a cadence change to the current window of the new cadence", async () => {
        // Keeping the old anchor is what leaves a monthly budget running the 15th
        // to the 14th after a detour through Week.
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchBudget(db, id, { type: BUDGET_TYPE.week });

        const row = getBudgetById(db, id);
        expect(row?.type).toBe(BUDGET_TYPE.week);
        expect(row?.startDate?.getTime()).toBe(startOfPeriod(new Date(), BUDGET_TYPE.week).getTime());
    });

    it("keeps a hand-set anchor when the cadence is restated rather than changed", async () => {
        // The limit sheet sends the cadence it opened on whether or not it was
        // touched, so treating its presence as a change threw away a start date
        // the user had set by hand every time they adjusted the amount.
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId: "cat-1",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchBudget(db, id, { amount: 300, type: BUDGET_TYPE.month });

        const row = getBudgetById(db, id);
        expect(row?.amount).toBe(300);
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("keeps a date the caller named even while changing the cadence", async () => {
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, { amount: 250, categoryId: "cat-1", type: BUDGET_TYPE.month });

        await budgetsRepo.patchBudget(db, id, { startDate: BACKDATE, type: BUDGET_TYPE.week });

        const row = getBudgetById(db, id);
        expect(row?.startDate?.getTime()).toBe(BACKDATE.getTime());
    });

    it("keeps the currency the limit was set in when only the window moves", async () => {
        // A EUR 100 budget shown as roughly USD 110 must not become a USD 100 one
        // because the cadence changed: the number is the row's own, and reading it
        // as today's ledger currency silently restates the target.
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: 0,
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });
        const id = await budgetsRepo.createBudget(db, {
            amount: 450,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });
        // The ledger moves to USD after the budget was set.
        await db.update(appMeta).set({ value: "USD" }).where(eq(appMeta.key, "currency"));

        await budgetsRepo.patchBudget(db, id, { type: BUDGET_TYPE.week });

        const row = getBudgetById(db, id);
        expect(row?.currency).toBe("EUR");
        expect(row?.amount).toBe(450);
        expect(row?.amountUsd).toBe(500);
    });

    it("does nothing for a budget that is already gone", async () => {
        const db = makeDb();
        await expect(budgetsRepo.patchBudget(db, "gone", { amount: 10 })).resolves.toBeUndefined();
    });
});

describe("budgetsRepo.patchMainBudget", () => {
    it("changes the limit without clearing the name or carry-over", async () => {
        // The overall budget had no field-level write at all: the only way in was
        // `createMainBudget`, and going through it from the form wiped both.
        const db = makeDb();
        const id = await budgetsRepo.createMainBudget(db, {
            amount: 2000,
            name: "Household",
            rollover: true,
            type: BUDGET_TYPE.month,
        });

        await budgetsRepo.patchMainBudget(db, id, { amount: 2400 });

        const [row] = await db.select().from(mainBudget).where(eq(mainBudget.id, id));
        expect(row?.amount).toBe(2400);
        expect(row?.name).toBe("Household");
        expect(row?.rollover).toBe(true);
    });

    it("writes one fact at a time", async () => {
        const db = makeDb();
        const id = await budgetsRepo.createMainBudget(db, { amount: 2000, type: BUDGET_TYPE.month });

        await budgetsRepo.patchMainBudget(db, id, { rollover: true });
        await budgetsRepo.patchMainBudget(db, id, { name: "   " });
        await budgetsRepo.patchMainBudget(db, id, { type: BUDGET_TYPE.week });

        const [row] = await db.select().from(mainBudget).where(eq(mainBudget.id, id));
        expect(row?.amount).toBe(2000);
        expect(row?.rollover).toBe(true);
        expect(row?.name).toBeNull();
        expect(row?.type).toBe(BUDGET_TYPE.week);
    });
});

describe("an edited budget stays coherent", () => {
    it("keeps its settings-derived anchor and agrees with limitIn on both sides", async () => {
        const db = makeDb();
        await db.insert(appMeta).values([
            { key: "currency", value: "EUR" },
            { key: "firstDayOfMonth", value: "25" },
        ]);
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: 0,
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });
        const rates = buildRateTable([{ date: "2020-01-01", quote: "EUR", rate: 0.9 }]);

        const id = await budgetsRepo.createBudget(db, {
            amount: 450,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });
        const anchor = startOfPeriod(new Date(), BUDGET_TYPE.month, {
            firstDayOfMonth: 25,
            firstWeekday: 1,
        });

        const created = getBudgetById(db, id);
        if (!created) {
            throw new Error("expected the budget to exist");
        }
        expect(created.startDate?.getTime()).toBe(anchor.getTime());
        expect(created.amountUsd).toBe(500);
        expect(limitIn(created, anchor, "USD", rates)).toBe(500);

        await budgetsRepo.patchBudget(db, id, { amount: 900 });

        const edited = getBudgetById(db, id);
        if (!edited) {
            throw new Error("expected the budget to exist");
        }
        expect(edited.startDate?.getTime()).toBe(anchor.getTime());
        expect(edited.amountUsd).toBe(1000);
        expect(limitIn(edited, anchor, "USD", rates)).toBe(1000);
    });
});

describe("budgetsRepo stamps the currency it was set in", () => {
    it("names the ledger's currency and freezes the target's USD value", async () => {
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: 0,
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });

        const id = await budgetsRepo.createBudget(db, {
            amount: 400,
            categoryId: "cat",
            name: null,
            startDate: null,
            type: 3,
        });

        const [row] = await db
            .select({
                amount: budgets.amount,
                amountUsd: budgets.amountUsd,
                currency: budgets.currency,
            })
            .from(budgets)
            .where(eq(budgets.id, id));
        expect(row.amount).toBe(400);
        expect(row.currency).toBe("EUR");
        // 400 EUR / 0.9.
        expect(Math.round((row.amountUsd ?? 0) * 100) / 100).toBe(444.44);
    });

    it("freezes the USD value on the day the anchored window opens", async () => {
        // `limitIn` restates the target at the window's day, so a value frozen at
        // the write instant would be converted from a rate it was never set at.
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values([
            {
                date: "2026-02-01",
                fetchedAt: 0,
                quote: "EUR",
                rate: 0.9,
                rateType: "official",
                source: "frankfurter",
            },
            {
                date: "2026-06-01",
                fetchedAt: 0,
                quote: "EUR",
                rate: 0.5,
                rateType: "official",
                source: "frankfurter",
            },
        ]);

        const id = await budgetsRepo.createBudget(db, {
            amount: 400,
            categoryId: "cat",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });

        const [row] = await db.select({ amountUsd: budgets.amountUsd }).from(budgets).where(eq(budgets.id, id));
        // 400 EUR / 0.9, February's rate — not 0.5, the rate on the day of the write.
        expect(Math.round((row.amountUsd ?? 0) * 100) / 100).toBe(444.44);
    });

    it("stores the amount unsigned", async () => {
        const db = makeDb();
        const id = await budgetsRepo.createBudget(db, {
            amount: -250,
            categoryId: "cat",
            name: null,
            startDate: null,
            type: 3,
        });
        const [row] = await db.select({ amount: budgets.amount }).from(budgets).where(eq(budgets.id, id));
        expect(row.amount).toBe(250);
    });
});

describe("a budget stepped back to a closed window", () => {
    it("values its limit at that window's day, not at the current one", async () => {
        // The rule PR #157 settled: the target is subtracted from spending valued
        // at the window's own days, so stepping back to March must restate the
        // limit in March money or the leftover means nothing.
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values([
            {
                date: "2026-03-01",
                fetchedAt: 0,
                quote: "EUR",
                rate: 0.9,
                rateType: "official",
                source: "frankfurter",
            },
            {
                date: "2026-07-01",
                fetchedAt: 0,
                quote: "EUR",
                rate: 0.5,
                rateType: "official",
                source: "frankfurter",
            },
        ]);
        const rates = buildRateTable([
            { date: "2026-03-01", quote: "EUR", rate: 0.9 },
            { date: "2026-07-01", quote: "EUR", rate: 0.5 },
        ]);

        const current = new Date(2026, 6, 1);
        const id = await budgetsRepo.createBudget(db, {
            amount: 450,
            categoryId: "cat-1",
            startDate: current,
            type: BUDGET_TYPE.month,
        });
        const row = getBudgetById(db, id);
        if (!row) {
            throw new Error("expected the budget to exist");
        }

        const july = shiftWindow(current, BUDGET_TYPE.month, 0);
        const march = shiftWindow(current, BUDGET_TYPE.month, -4);
        expect(march.start).toStrictEqual(new Date(2026, 2, 1));

        expect(limitIn(row, july.start, "USD", rates)).toBe(900);
        expect(limitIn(row, march.start, "USD", rates)).toBe(500);
    });

    it("falls back to the frozen value when no rate reaches the window", async () => {
        const db = makeDb();
        await db.insert(appMeta).values({ key: "currency", value: "EUR" });
        await db.insert(exchangeRates).values({
            date: "2026-07-01",
            fetchedAt: 0,
            quote: "EUR",
            rate: 0.5,
            rateType: "official",
            source: "frankfurter",
        });
        const rates = buildRateTable([{ date: "2026-07-01", quote: "EUR", rate: 0.5 }]);

        const current = new Date(2026, 6, 1);
        const id = await budgetsRepo.createBudget(db, {
            amount: 450,
            categoryId: "cat-1",
            startDate: current,
            type: BUDGET_TYPE.month,
        });
        const row = getBudgetById(db, id);
        if (!row) {
            throw new Error("expected the budget to exist");
        }

        const march = shiftWindow(current, BUDGET_TYPE.month, -4);
        // 450 / 0.5: the write-time freeze, since March predates every EUR rate.
        expect(limitIn(row, march.start, "USD", rates)).toBe(900);
    });
});

describe("budgetsRepo.deleteBudget", () => {
    let db: Database;

    beforeEach(async () => {
        db = migratedDatabase();
        // Before the gate opens, so the category's own insert queues nothing.
        await db.insert(categories).values({
            id: "cat-1",
            income: false,
            name: "Coffee",
            updatedAt: BACKDATE,
        });
        await setSyncEnabled(db, true);
    });

    function add(categoryId: string): Promise<string> {
        return budgetsRepo.createBudget(db, {
            amount: 250,
            categoryId,
            name: "Coffee cap",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });
    }

    it("queues the delete instead of clearing what a push already drained", async () => {
        const id = await add("cat-1");
        await db.delete(outbox);

        await budgetsRepo.deleteBudget(db, id);

        // A hard delete fires the AFTER DELETE trigger, which removes the entry: the
        // peer never hears of the delete, keeps the budget, and pushes it back at a
        // fresh seq the moment its own period rolls over.
        await expect(queued(db)).resolves.toStrictEqual([["budgets", id]]);
    });

    it("leaves a tombstone no read can reach", async () => {
        const id = await add("cat-1");

        await budgetsRepo.deleteBudget(db, id);

        expect(getBudgetById(db, id)).toBeNull();
        const live = await db.select().from(budgets).where(isNull(budgets.deletedAt));
        expect(live).toHaveLength(0);

        const replicable = await db.select().from(budgets);
        expect(replicable).toHaveLength(1);
        expect(replicable[0]?.id).toBe(id);
        expect(replicable[0]?.deletedAt).not.toBeNull();
    });

    it("strips everything personal off the tombstone", async () => {
        const id = await add("cat-1");

        await budgetsRepo.deleteBudget(db, id);

        const [row] = await db.select().from(budgets);
        expect(row.name).toBeNull();
        expect(row.amount).toBe(0);
        expect(row.type).toBe(0);
        expect(row.startDate).toBeNull();
        expect(row.dateCreated).toBeNull();
        expect(row.currency).toBeNull();
        expect(row.amountUsd).toBeNull();
        expect(row.green).toBe(false);
        expect(row.categoryId).toBeNull();
    });

    it("frees the category so the same one can be budgeted again", async () => {
        const first = await add("cat-1");
        await budgetsRepo.deleteBudget(db, first);

        const second = await add("cat-1");

        const live = await db.select().from(budgets).where(isNull(budgets.deletedAt));
        expect(live).toHaveLength(1);
        expect(live[0]?.id).toBe(second);
        expect(live[0]?.categoryId).toBe("cat-1");
    });

    it("leaves a tombstone it already wrote alone", async () => {
        const id = await add("cat-1");
        await budgetsRepo.deleteBudget(db, id);
        const [first] = await db.select().from(budgets);
        await db.delete(outbox);

        await budgetsRepo.deleteBudget(db, id);

        const [second] = await db.select().from(budgets);
        expect(second.deletedAt?.getTime()).toBe(first.deletedAt?.getTime());
        expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
        await expect(queued(db)).resolves.toStrictEqual([]);
    });
});

describe("budgetsRepo.deleteMainBudget", () => {
    let db: Database;

    beforeEach(async () => {
        db = migratedDatabase();
        await setSyncEnabled(db, true);
    });

    function add(): Promise<string> {
        return budgetsRepo.createMainBudget(db, {
            amount: 2000,
            name: "Everything",
            startDate: BACKDATE,
            type: BUDGET_TYPE.month,
        });
    }

    it("tombstones the singleton rather than dropping it", async () => {
        const id = await add();
        await db.delete(outbox);

        await budgetsRepo.deleteMainBudget(db, id);

        await expect(queued(db)).resolves.toStrictEqual([["mainBudget", id]]);
        const replicable = await db.select().from(mainBudget);
        expect(replicable).toHaveLength(1);
        expect(replicable[0]?.deletedAt).not.toBeNull();
        expect(replicable[0]?.name).toBeNull();
        expect(replicable[0]?.amount).toBe(0);
        expect(replicable[0]?.startDate).toBeNull();

        const live = await db.select().from(mainBudget).where(isNull(mainBudget.deletedAt));
        expect(live).toHaveLength(0);
    });

    it("lets a new overall budget be set without reviving the tombstone", async () => {
        const first = await add();
        await budgetsRepo.deleteMainBudget(db, first);

        const second = await add();

        expect(second).not.toBe(first);
        const live = await db.select().from(mainBudget).where(isNull(mainBudget.deletedAt));
        expect(live).toHaveLength(1);
        expect(live[0]?.id).toBe(second);
        expect(live[0]?.amount).toBe(2000);
    });
});

// A column added to either table and not to its tombstone constant would keep
// the user's value on a deleted row, and no round-trip assertion above would
// notice. `erase-core.ts` writes these same two shapes in bulk, so this holds
// both call sites at once.
describe("the budget tombstone shapes", () => {
    const ENVELOPE = new Set(["id", "updatedAt", "deletedAt"]);

    it("names every column of a budget that is not the envelope", () => {
        const declared = Object.keys(getTableColumns(budgets)).filter((name) => !ENVELOPE.has(name));

        expect(Object.keys(TOMBSTONED_BUDGET).sort()).toStrictEqual(declared.sort());
    });

    it("names every column of the overall budget that is not the envelope", () => {
        const declared = Object.keys(getTableColumns(mainBudget)).filter((name) => !ENVELOPE.has(name));

        expect(Object.keys(TOMBSTONED_MAIN_BUDGET).sort()).toStrictEqual(declared.sort());
    });
});
