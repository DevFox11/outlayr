import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { buildRateTable } from "@/domain/valuation";

import { useSparklineRows } from "./log-totals";

const NOW = new Date(Date.UTC(2026, 6, 15, 12));

const makeDb = migratedDatabase;

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

        await expect(sparklineAmounts(db, "VES")).resolves.toStrictEqual([40]);
    });

    it("charts zero instead of face value when the sparkline uses a foreign currency", async () => {
        const db = makeDb();
        await seedPendingCustom(db);

        await expect(sparklineAmounts(db, "EUR")).resolves.toStrictEqual([0]);
    });
});
