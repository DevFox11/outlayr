import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, exchangeRates, savingsGoals } from "@/db/schema";
import { testDatabase } from "@/db/test-database";

import { GoalValuationError, savingsGoalsQuery, savingsGoalsRepo } from "./savings-goals-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    for (const file of readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
            if (statement.trim()) {
                sqlite.exec(statement);
            }
        }
    }
    return testDatabase(sqlite);
}

const AUTHORED = new Date("2026-03-04T10:00:00.000Z");

/** A rate for `quote`, so a goal in it can be canonicalised at all. */
async function withRate(quote: string, rate: number): Promise<void> {
    await db.insert(exchangeRates).values({
        date: "2026-01-01",
        fetchedAt: AUTHORED.getTime(),
        quote,
        rate,
        rateType: "official",
        source: "test",
    });
}

const DUE = new Date("2027-03-04T10:00:00.000Z");
let db: Database;

beforeEach(() => {
    db = makeDb();
    db.insert(accounts)
        .values({
            currency: "USD",
            dateCreated: AUTHORED,
            id: "savings",
            initialBalance: 0,
            initialBalanceDate: AUTHORED,
            name: "Savings",
            updatedAt: AUTHORED,
        })
        .run();
});

function goal(overrides: Partial<Parameters<typeof savingsGoalsRepo.create>[1]> = {}) {
    return savingsGoalsRepo.create(db, {
        accountId: "savings",
        currency: "USD",
        name: "Emergency fund",
        startAmount: 0,
        targetAmount: 5000,
        targetDate: DUE,
        ...overrides,
    });
}

describe("savings goals", () => {
    it("writes a goal that reads back", async () => {
        await goal();
        const [row] = await savingsGoalsQuery(db);
        expect(row).toMatchObject({ accountId: "savings", name: "Emergency fund", targetAmount: 5000 });
    });

    it("orders goals by their sort position", async () => {
        await goal({ name: "First" });
        await goal({ name: "Second" });
        const rows = await savingsGoalsQuery(db);
        expect(rows.map((row) => row.name)).toStrictEqual(["First", "Second"]);
    });

    it("keeps a deleted goal out of every read", async () => {
        const id = await goal();
        await savingsGoalsRepo.remove(db, id);
        await expect(savingsGoalsQuery(db)).resolves.toStrictEqual([]);
    });

    it("re-freezes the USD target only when the amount or currency moves", async () => {
        const id = await goal();
        const [before] = await savingsGoalsQuery(db);

        await savingsGoalsRepo.update(db, id, { name: "Rainy day" });
        const [renamed] = await savingsGoalsQuery(db);
        expect(renamed.targetAmountUsd).toBe(before.targetAmountUsd);
        expect(renamed.name).toBe("Rainy day");

        await savingsGoalsRepo.update(db, id, { targetAmount: 6000 });
        const [raised] = await savingsGoalsQuery(db);
        expect(raised.targetAmount).toBe(6000);
    });

    it("holds the balance the goal opened against through an unrelated edit", async () => {
        const id = await goal({ startAmount: 1200 });
        const [opened] = await savingsGoalsQuery(db);
        expect(opened.startAmount).toBe(1200);

        // Raising the target does not move the line every figure on the detail
        // screen is measured against. Only a currency restatement does.
        await savingsGoalsRepo.update(db, id, { targetAmount: 6000 });
        const [raised] = await savingsGoalsQuery(db);
        expect(raised.startAmount).toBe(1200);
        expect(raised.startAmountUsd).toBe(opened.startAmountUsd);
    });

    it("leaves an untouched target exactly as stored, currency and all", async () => {
        await withRate("EUR", 0.9);
        // The retarget sheet states the target in the ledger's display currency, so
        // a figure the reader never typed is the stored one already converted.
        // Committing only the date must not write that converted number back.
        const id = await goal({ currency: "EUR", targetAmount: 1000 });
        const [before] = await savingsGoalsQuery(db);

        await savingsGoalsRepo.update(db, id, { targetDate: new Date("2027-09-04T10:00:00.000Z") });

        const [after] = await savingsGoalsQuery(db);
        expect(after.targetAmount).toBe(1000);
        expect(after.currency).toBe("EUR");
        expect(after.targetAmountUsd).toBe(before.targetAmountUsd);
        expect(after.targetDate.getTime()).toBe(new Date("2027-09-04T10:00:00.000Z").getTime());
    });

    it("keeps a goal in the currency it was set in, whatever is retyped", async () => {
        await withRate("EUR", 0.9);
        const id = await goal({ currency: "EUR", startAmount: 500, targetAmount: 1000 });

        // The sheet is opened in the goal's own currency, so a typed figure needs
        // no restating — and the anchor it is measured from stays put.
        await savingsGoalsRepo.update(db, id, { targetAmount: 1200 });

        const [after] = await savingsGoalsQuery(db);
        expect(after.targetAmount).toBe(1200);
        expect(after.currency).toBe("EUR");
        expect(after.startAmount).toBe(500);
    });

    it("freezes a zero anchor as zero USD, not as an unconvertible null", async () => {
        // Zero is exactly zero in every currency, and a null would be read as a
        // failed conversion — withholding the goal's figures for as long as the
        // display currency differed from its own.
        await withRate("EUR", 0.9);
        await goal({ currency: "EUR", startAmount: 0, targetAmount: 1000 });

        const [row] = await savingsGoalsQuery(db);
        expect(row.startAmountUsd).toBe(0);
    });

    it("falls back to the pair when a peer cleared the goal's rate", async () => {
        // The server clears `exchangeRate` when an older client sends a target it
        // valued itself — the stored rate and that pair would otherwise describe
        // different days. Whatever arrives, a restatement must stay on one basis.
        await withRate("EUR", 0.8);
        const id = await goal({ currency: "EUR", targetAmount: 1000 });
        await db.update(savingsGoals).set({ exchangeRate: null }).where(eq(savingsGoals.id, id));
        const [before] = await savingsGoalsQuery(db);
        const rate = before.targetAmount / (before.targetAmountUsd ?? 1);

        await db.delete(exchangeRates).run?.();
        await withRate("EUR", 0.5);
        await savingsGoalsRepo.update(db, id, { targetAmount: 2000 });

        const [after] = await savingsGoalsQuery(db);
        expect(after.targetAmount / (after.targetAmountUsd ?? 1)).toBeCloseTo(rate, 8);
    });

    it("goes with the account it tracks", async () => {
        // The goal has no meaning without the balance behind it, so the foreign key
        // cascades rather than leaving a target pointing at nothing.
        await goal();
        db.run?.("DELETE FROM accounts WHERE id = 'savings'");
        await expect(savingsGoalsQuery(db)).resolves.toStrictEqual([]);
    });

    it("refuses a goal whose figures cannot be valued in USD", async () => {
        // Ledger and account share a currency, so nothing on screen looks
        // approximate — but with no rate for it there is no USD to freeze, and a
        // null reads back as the face value the day the display currency changes.
        await expect(goal({ currency: "VES", startAmount: 100, targetAmount: 5000 })).rejects.toThrow(
            GoalValuationError
        );
        await expect(savingsGoalsQuery(db)).resolves.toStrictEqual([]);
    });

    it("restates a target at the rate the goal was frozen against, not today's history", async () => {
        // Rate history is pruned to one row per pair per calendar month once it
        // leaves the 90-day window, so a lookup for an old `dateCreated` can land on
        // the previous month's row. The goal's own frozen pair is that rate exactly.
        await withRate("EUR", 0.8);
        const id = await goal({ currency: "EUR", targetAmount: 1000 });
        const [before] = await savingsGoalsQuery(db);
        const rate = before.targetAmount / (before.targetAmountUsd ?? 1);

        // A different rate is all that survives by the time the target is re-typed.
        await db.delete(exchangeRates).run?.();
        await withRate("EUR", 0.5);
        await savingsGoalsRepo.update(db, id, { targetAmount: 2000 });

        const [after] = await savingsGoalsQuery(db);
        expect(after.targetAmount / (after.targetAmountUsd ?? 1)).toBeCloseTo(rate, 8);
    });

    it("falls back to a legacy goal's own pair rather than a rate that has moved", async () => {
        // Written before the rate column existed, so `exchangeRate` is null and the
        // stored pair is the only record of what valued it.
        await withRate("EUR", 0.8);
        const id = await goal({ currency: "EUR", targetAmount: 1000 });
        await db.update(savingsGoals).set({ exchangeRate: null }).where(eq(savingsGoals.id, id));
        const [before] = await savingsGoalsQuery(db);
        const rate = before.targetAmount / (before.targetAmountUsd ?? 1);

        await db.delete(exchangeRates).run?.();
        await withRate("EUR", 0.5);
        await savingsGoalsRepo.update(db, id, { targetAmount: 2000 });

        const [after] = await savingsGoalsQuery(db);
        expect(after.targetAmount / (after.targetAmountUsd ?? 1)).toBeCloseTo(rate, 8);
    });

    it("refuses a re-typed target it cannot value, rather than storing a null", async () => {
        const id = await goal();
        await expect(savingsGoalsRepo.update(db, id, { targetAmount: 9000 })).resolves.toBeUndefined();

        const [row] = await savingsGoalsQuery(db);
        expect(row.targetAmountUsd).not.toBeNull();
    });

    it("refuses to update a goal that is not there", async () => {
        await expect(savingsGoalsRepo.update(db, "missing", { name: "x" })).rejects.toThrow("not found");
    });
});
