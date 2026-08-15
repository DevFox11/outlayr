import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { toast } from "panelui-native";

import type { Database } from "@/db/client";
import { accounts, budgets, categories, mainBudget, transactions, transfers } from "@/db/schema";
import { testDatabase } from "@/db/test-database";
import { BUDGET_TYPE } from "@/domain/budget-math";
import { firstOfMonth, startOfDay } from "@/domain/dates";

import { accountsRepo } from "./accounts-core";
import { budgetsRepo } from "./budgets-core";
import { createDeferredDeleteRegistry, UNDO_WINDOW_MS } from "./deferred-delete-registry";
import { transfersRepo } from "./transfers-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");
const DAY = new Date(Date.UTC(2026, 7, 9));

/** The shipped migrations, applied in order — five tables and their triggers. */
function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    const files = readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort();
    for (const file of files) {
        for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
            if (statement.trim()) {
                sqlite.exec(statement);
            }
        }
    }
    return testDatabase(sqlite);
}

/** Drains the promise chain a commit runs on; `setImmediate` is left unfaked for it. */
function settle(): Promise<void> {
    return new Promise((resolve) => {
        setImmediate(resolve);
    });
}

/** A registry already pointed at `db`, which the provider does in an effect. */
function registryFor(db: Database | null) {
    const registry = createDeferredDeleteRegistry();
    registry.attachDatabase(db);
    return registry;
}

function logRow(db: Database, id: string): Promise<unknown> {
    return db.insert(transactions).values({
        amount: 12,
        date: DAY,
        day: startOfDay(DAY),
        id,
        income: false,
        month: firstOfMonth(DAY),
        note: "Coffee",
        updatedAt: new Date(),
    });
}

describe("createDeferredDeleteRegistry", () => {
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("holds the write for the undo window, then commits it", async () => {
        const db = makeDb();
        await logRow(db, "tx-1");
        const registry = registryFor(db);

        registry.requestDelete("row", "tx-1");
        expect(registry.pendingId("row")).toBe("tx-1");
        const [held] = await db.select().from(transactions).where(eq(transactions.id, "tx-1"));
        expect(held.deletedAt).toBeNull();

        jest.advanceTimersByTime(UNDO_WINDOW_MS);
        await settle();

        const [written] = await db.select().from(transactions).where(eq(transactions.id, "tx-1"));
        expect(written.deletedAt).not.toBeNull();
        expect(registry.pendingId("row")).toBeNull();
    });

    it("writes nothing when the offer is taken up", async () => {
        const db = makeDb();
        await logRow(db, "tx-1");
        const registry = registryFor(db);
        const show = jest.spyOn(toast, "show").mockReturnValue("toast-1");

        registry.requestDelete("row", "tx-1");
        // The undo lives on the toast, so its button is the only way to reach it.
        const offered = show.mock.calls[0][0] as { onActionPress: (handle: unknown) => void };
        offered.onActionPress(null);

        jest.advanceTimersByTime(UNDO_WINDOW_MS * 2);
        await settle();

        const [row] = await db.select().from(transactions).where(eq(transactions.id, "tx-1"));
        expect(row.deletedAt).toBeNull();
        expect(registry.pendingId("row")).toBeNull();
    });

    it("takes a transfer out through the transfers repo without being told it is one", async () => {
        const db = makeDb();
        const from = await accountsRepo.create(db, { currency: "USD", name: "Zinli" });
        const to = await accountsRepo.create(db, { currency: "USD", name: "Banesco" });
        const id = await transfersRepo.create(db, {
            date: DAY,
            exchangeRate: null,
            exchangeRateType: null,
            fromAccountId: from,
            fromAmount: 100,
            fromCurrency: "USD",
            toAccountId: to,
            toAmount: 100,
            toCurrency: "USD",
        });
        const registry = registryFor(db);

        registry.requestDelete("row", id);
        registry.flushAll();
        await settle();

        const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
        expect(transfer.deletedAt).not.toBeNull();
    });

    it("routes the overall budget to its own table and a per-category one to the other", async () => {
        const db = makeDb();
        await db.insert(categories).values({
            dateCreated: DAY,
            id: "cat-1",
            income: false,
            name: "Food",
            updatedAt: DAY,
        });
        const overall = await budgetsRepo.createMainBudget(db, { amount: 500, type: BUDGET_TYPE.month });
        const perCategory = await budgetsRepo.createBudget(db, {
            amount: 100,
            categoryId: "cat-1",
            type: BUDGET_TYPE.month,
        });
        const registry = registryFor(db);

        registry.requestDelete("budget", overall);
        registry.flushAll();
        await settle();
        registry.requestDelete("budget", perCategory);
        registry.flushAll();
        await settle();

        const [main] = await db.select().from(mainBudget).where(eq(mainBudget.id, overall));
        const [category] = await db.select().from(budgets).where(eq(budgets.id, perCategory));
        expect(main.deletedAt).not.toBeNull();
        expect(category.deletedAt).not.toBeNull();
    });

    it("keeps each kind's window to itself", async () => {
        const db = makeDb();
        await logRow(db, "tx-1");
        const account = await accountsRepo.create(db, { currency: "USD", name: "Cash" });
        const registry = registryFor(db);

        registry.requestDelete("row", "tx-1");
        registry.requestDelete("account", account);
        expect(registry.pendingId("row")).toBe("tx-1");
        expect(registry.pendingId("account")).toBe(account);

        jest.advanceTimersByTime(UNDO_WINDOW_MS);
        await settle();

        const [row] = await db.select().from(transactions).where(eq(transactions.id, "tx-1"));
        const [held] = await db.select().from(accounts).where(eq(accounts.id, account));
        expect(row.deletedAt).not.toBeNull();
        expect(held.deletedAt).not.toBeNull();
    });

    it("says so when the write loses, and does not say it twice", async () => {
        const registry = registryFor(null);
        const show = jest.spyOn(toast, "show").mockReturnValue("toast-1");

        registry.requestDelete("account", "acc-1");
        jest.advanceTimersByTime(UNDO_WINDOW_MS);
        await settle();

        const failures = show.mock.calls.filter(
            ([notice]) => typeof notice !== "string" && notice.variant === "destructive"
        );
        expect(failures).toHaveLength(1);
    });

    it("replaces the offer rather than reusing it when a second row goes mid-window", async () => {
        const db = makeDb();
        await logRow(db, "tx-1");
        await logRow(db, "tx-2");
        const registry = registryFor(db);
        const show = jest.spyOn(toast, "show").mockReturnValue("toast-1");
        const hide = jest.spyOn(toast, "hide").mockImplementation(() => {});

        registry.requestDelete("row", "tx-1");
        registry.requestDelete("row", "tx-2");

        expect(hide).toHaveBeenCalledWith("toast-1");
        expect(show).toHaveBeenCalledTimes(2);
        // The displaced row's window closed early rather than being dropped.
        await settle();
        const [first] = await db.select().from(transactions).where(eq(transactions.id, "tx-1"));
        expect(first.deletedAt).not.toBeNull();
    });
});
