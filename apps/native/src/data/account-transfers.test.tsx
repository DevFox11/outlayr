import { beforeEach, describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { Text } from "react-native";

import type { Database } from "@/db/client";
import { accounts, transfers } from "@/db/schema";
import { testDatabase } from "@/db/test-database";
import type { TransferLogRow } from "@/domain/transfer-log-rows";

import { useAccountTransfers } from "./account-transfers";

const AUG_9 = new Date(Date.UTC(2026, 7, 9, 12));
const AUG_10 = new Date(Date.UTC(2026, 7, 10, 12));

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			currency text NOT NULL,
			customColor text,
			emoji text,
			icon text,
			imageColor text,
			imageKey text,
			imageUri text,
			initialBalance real NOT NULL DEFAULT 0,
			initialBalanceDate integer NOT NULL,
			kind text NOT NULL DEFAULT 'asset',
			initialBalanceUsd real,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer NOT NULL,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transfers (
			id text PRIMARY KEY NOT NULL,
			fromAccountId text NOT NULL,
			toAccountId text NOT NULL,
			fromAmount real NOT NULL,
			fromCurrency text NOT NULL,
			fromAmountUsd real,
			toAmount real NOT NULL,
			toCurrency text NOT NULL,
			toAmountUsd real,
			exchangeRate real,
			exchangeRateType text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			note text DEFAULT '' NOT NULL,
			dateCreated integer NOT NULL,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
    return testDatabase(sqlite);
}

async function addAccount(db: Database, id: string, name: string): Promise<void> {
    await db.insert(accounts).values({
        currency: "USD",
        dateCreated: AUG_9,
        id,
        initialBalanceDate: AUG_9,
        name,
        updatedAt: AUG_9,
    });
}

async function addTransfer(
    db: Database,
    row: Partial<typeof transfers.$inferInsert> & { id: string; fromAccountId: string; toAccountId: string }
): Promise<void> {
    await db.insert(transfers).values({
        date: AUG_9,
        dateCreated: AUG_9,
        day: AUG_9,
        fromAmount: 40,
        fromCurrency: "USD",
        month: AUG_9,
        toAmount: 40,
        toCurrency: "USD",
        updatedAt: AUG_9,
        ...row,
    });
}

async function readTransfers(db: Database, accountId: string): Promise<TransferLogRow[]> {
    let seen: TransferLogRow[] = [];
    function Probe() {
        seen = useAccountTransfers(db, accountId);
        return <Text testID="probe">{seen.length}</Text>;
    }
    await render(<Probe />);
    return seen;
}

describe("an account's transfers", () => {
    let db: Database;

    beforeEach(async () => {
        db = makeDb();
        await addAccount(db, "checking", "Checking");
        await addAccount(db, "savings", "Savings");
    });

    it("includes money that arrived from another account", async () => {
        await addTransfer(db, { fromAccountId: "checking", id: "tr1", toAccountId: "savings" });

        const rows = await readTransfers(db, "savings");
        expect(rows.map((row) => row.id)).toStrictEqual(["tr1"]);
    });

    it("includes money that left for another account", async () => {
        await addTransfer(db, { fromAccountId: "checking", id: "tr1", toAccountId: "savings" });

        const rows = await readTransfers(db, "checking");
        expect(rows.map((row) => row.id)).toStrictEqual(["tr1"]);
    });

    it("names both ends of the move on a row that carries no note", async () => {
        await addTransfer(db, { fromAccountId: "checking", id: "tr1", toAccountId: "savings" });

        const rows = await readTransfers(db, "savings");
        expect(rows[0].note).toBe("Checking → Savings");
    });

    it("keeps the row out of every total", async () => {
        await addTransfer(db, { fromAccountId: "checking", id: "tr1", toAccountId: "savings" });

        const rows = await readTransfers(db, "savings");
        expect(rows[0].excludedFromTotals).toBe(true);
    });

    it("ignores a transfer between two other accounts", async () => {
        await addAccount(db, "cash", "Cash");
        await addTransfer(db, { fromAccountId: "checking", id: "tr1", toAccountId: "cash" });

        await expect(readTransfers(db, "savings")).resolves.toStrictEqual([]);
    });

    it("ignores a transfer that was deleted", async () => {
        await addTransfer(db, { deletedAt: AUG_9, fromAccountId: "checking", id: "tr1", toAccountId: "savings" });

        await expect(readTransfers(db, "savings")).resolves.toStrictEqual([]);
    });

    it("lists the newest first", async () => {
        await addTransfer(db, { fromAccountId: "checking", id: "older", toAccountId: "savings" });
        await addTransfer(db, {
            date: AUG_10,
            day: AUG_10,
            fromAccountId: "savings",
            id: "newer",
            toAccountId: "checking",
        });

        const rows = await readTransfers(db, "savings");
        expect(rows.map((row) => row.id)).toStrictEqual(["newer", "older"]);
    });
});
