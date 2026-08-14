import { renderHook } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { buildRateTable } from "@/domain/valuation";

import { useInsights } from "./use-insights";

const mockUseValuation = jest.fn();

jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: () => ({ remove: () => undefined }),
}));

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
}));

jest.mock("./use-valuation", () => ({
    useValuation: () => mockUseValuation(),
}));

const NOW = new Date(Date.UTC(2026, 6, 15, 12));

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE categories (
			id text PRIMARY KEY NOT NULL,
			name text,
			color text DEFAULT '#FFFFFF',
			icon text,
			emoji text,
			income integer NOT NULL DEFAULT 0,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer,
			parentId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
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
    await db.insert(categories).values({ id: "food", income: false, name: "Food", updatedAt: NOW });
    await db.insert(transactions).values({
        amount: 40,
        amountUsd: null,
        categoryId: "food",
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

describe("useInsights pending custom valuation", () => {
    it("excludes pending custom from a foreign-currency screen total", async () => {
        const db = makeDb();
        await seedPendingCustom(db);
        mockUseValuation.mockReturnValue({ displayCurrency: "EUR", rates: buildRateTable([]) });

        const { result, unmount } = await renderHook(() => useInsights(db, NOW.getTime(), "month", "spent"));

        expect(result.current.rows).toHaveLength(1);
        expect(result.current.rows[0]?.amount).toBe(0);
        expect(result.current.spent).toBe(0);
        await unmount();
    });

    it("keeps pending custom at face value on its native-currency screen", async () => {
        const db = makeDb();
        await seedPendingCustom(db);
        mockUseValuation.mockReturnValue({ displayCurrency: "VES", rates: buildRateTable([]) });

        const { result, unmount } = await renderHook(() => useInsights(db, NOW.getTime(), "month", "spent"));

        expect(result.current.rows).toHaveLength(1);
        expect(result.current.rows[0]?.amount).toBe(40);
        expect(result.current.spent).toBe(40);
        await unmount();
    });
});
