import { renderHook } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";

import { useSparklineRows } from "./log-totals";

jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => undefined }),
}));

const NOW = new Date(Date.UTC(2026, 6, 15, 12));

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			currency text,
			note text NOT NULL DEFAULT '',
			details text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			recurringAnchorDay integer,
			reminderLeadDays integer,
			categoryId text,
			accountId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			transferId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
    return drizzle(sqlite) as unknown as Database;
}

async function seedPendingCustom(db: Database): Promise<void> {
    await db.insert(transactions).values({
        amount: 40,
        amountUsd: null,
        currency: "VES",
        date: NOW,
        day: NOW,
        exchangeRate: null,
        exchangeRateType: "custom",
        id: "pending-custom",
        income: false,
        month: NOW,
        updatedAt: NOW,
    });
}

async function sparklineAmounts(db: Database, displayCurrency: string): Promise<number[]> {
    const { result, unmount } = await renderHook(() =>
        useSparklineRows(db, NOW.getTime(), true, false, null, displayCurrency, buildRateTable([]))
    );
    const amounts = result.current.map((row) => row.amount);
    await unmount();
    return amounts;
}

describe("useSparklineRows pending custom valuation", () => {
    it("charts the native amount when the sparkline uses the transaction currency", async () => {
        const db = makeDb();
        await seedPendingCustom(db);

        expect(await sparklineAmounts(db, "VES")).toStrictEqual([40]);
    });

    it("charts zero instead of face value when the sparkline uses a foreign currency", async () => {
        const db = makeDb();
        await seedPendingCustom(db);

        expect(await sparklineAmounts(db, "EUR")).toStrictEqual([0]);
    });
});
