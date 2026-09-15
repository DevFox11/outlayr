import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { buildRateTable } from "@/domain/valuation";

import { useAccountCells, useAccountsOverviewIn } from "./accounts";
import { accountsCellQuery, toCurrencyCell } from "./cell-query";
import type { CellRow } from "./cell-query";

const makeDb = () => migratedDatabase({ foreignKeys: false });

const JUNE_1 = new Date("2026-06-01T12:00:00.000Z");

async function addTransaction(
    db: Database,
    overrides: Partial<typeof transactions.$inferInsert> & { id: string }
): Promise<void> {
    await db.insert(transactions).values({
        amount: 10,
        amountUsd: 10,
        currency: "USD",
        date: JUNE_1,
        day: JUNE_1,
        income: false,
        month: JUNE_1,
        note: "",
        updatedAt: JUNE_1,
        ...overrides,
    });
}

describe("accountsCellQuery", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("groups attached rows by account, currency, direction and day", async () => {
        await addTransaction(db, { accountId: "a1", amount: 5, id: "t1" });
        await addTransaction(db, { accountId: "a1", amount: 7, id: "t2" });
        await addTransaction(db, {
            accountId: "a1",
            amount: 3,
            id: "t3",
            income: true,
        });
        await addTransaction(db, { accountId: "a2", amount: 11, id: "t4" });

        const rows = await accountsCellQuery(db);
        const byKey = rows.map((row) => ({
            accountId: row.accountId,
            ...toCurrencyCell(row),
        }));

        const a1Expense = byKey.find((cell) => cell.accountId === "a1" && !cell.income);
        expect(a1Expense?.amount).toBe(12);
        expect(a1Expense?.count).toBe(2);
        const a1Income = byKey.find((cell) => cell.accountId === "a1" && cell.income);
        expect(a1Income?.amount).toBe(3);
        expect(byKey.find((cell) => cell.accountId === "a2")?.amount).toBe(11);
    });

    it("excludes detached and soft-deleted rows", async () => {
        await addTransaction(db, { accountId: null, amount: 99, id: "t1" });
        await addTransaction(db, {
            accountId: "a1",
            amount: 5,
            deletedAt: JUNE_1,
            id: "t2",
        });
        await addTransaction(db, { accountId: "a1", amount: 4, id: "t3" });

        const rows = await accountsCellQuery(db);
        expect(rows).toHaveLength(1);
        expect(rows[0].accountId).toBe("a1");
        expect(toCurrencyCell(rows[0]).amount).toBe(4);
    });
});

jest.mock("./live-query", () => ({
    useLiveQuery: jest.fn<typeof import("./live-query").useLiveQuery>(),
}));

const mockUseLiveQuery = jest.mocked(jest.requireMock<typeof import("./live-query")>("./live-query").useLiveQuery);

function liveRow(overrides: Partial<CellRow> = {}): CellRow {
    return {
        currency: "USD",
        dateKey: "2026-08-06",
        income: true,
        rows: 1,
        total: 4,
        totalUsd: 4,
        unconverted: 0,
        unconvertedRows: 0,
        ...overrides,
    };
}

describe("useAccountCells", () => {
    beforeEach(() => {
        mockUseLiveQuery.mockReset();
    });

    it("keeps transaction cells and maps outbound and inbound transfers with opposite directions", async () => {
        const transaction = liveRow();
        const outbound = liveRow({ currency: "EUR", dateKey: "2026-08-07", income: false, total: 35, totalUsd: 40 });
        const inbound = liveRow({ currency: "VES", dateKey: "2026-08-08", income: false, total: 10, totalUsd: 1 });
        mockUseLiveQuery
            .mockReturnValueOnce([transaction])
            .mockReturnValueOnce([outbound])
            .mockReturnValueOnce([inbound]);

        const { result } = await renderHook(() => useAccountCells({} as Database, "account-1"));

        expect(result.current).toStrictEqual([
            {
                amount: 4,
                amountUsd: 4,
                count: 1,
                currencyCode: "USD",
                dateKey: "2026-08-06",
                income: true,
                rateNeededAmount: 0,
                rateNeededCount: 0,
                unconvertedAmount: 0,
                unconvertedCount: 0,
            },
            {
                amount: 35,
                amountUsd: 40,
                count: 1,
                currencyCode: "EUR",
                dateKey: "2026-08-07",
                income: false,
                rateNeededAmount: 0,
                rateNeededCount: 0,
                unconvertedAmount: 0,
                unconvertedCount: 0,
            },
            {
                amount: 10,
                amountUsd: 1,
                count: 1,
                currencyCode: "VES",
                dateKey: "2026-08-08",
                income: true,
                rateNeededAmount: 0,
                rateNeededCount: 0,
                unconvertedAmount: 0,
                unconvertedCount: 0,
            },
        ]);
    });
});

describe("useAccountsOverviewIn", () => {
    beforeEach(() => {
        mockUseLiveQuery.mockReset();
    });

    const valuation = { displayCurrency: "USD", rates: buildRateTable([]) };
    const account = (id: string, initialBalance: number) => ({
        currency: "USD",
        id,
        initialBalance,
        initialBalanceDate: JUNE_1,
        initialBalanceUsd: initialBalance,
        kind: "asset",
    });

    it("drops an account inside its undo window, cells and all", async () => {
        // `useAccounts`, then the transaction cells, then outbound and inbound transfers.
        mockUseLiveQuery
            .mockReturnValueOnce([account("keep", 100), account("going", 50)])
            .mockReturnValueOnce([{ ...liveRow({ income: false, total: 5, totalUsd: 5 }), accountId: "going" }])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const { result } = await renderHook(() => useAccountsOverviewIn({} as Database, valuation, "going"));

        expect(result.current?.count).toBe(1);
        expect(result.current?.total).toBe(100);
        expect(result.current?.rows.map((row) => row.id)).toStrictEqual(["keep"]);
    });

    it("keeps every account when nothing is pending", async () => {
        mockUseLiveQuery
            .mockReturnValueOnce([account("keep", 100), account("going", 50)])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        const { result } = await renderHook(() => useAccountsOverviewIn({} as Database, valuation, null));

        expect(result.current?.count).toBe(2);
        expect(result.current?.total).toBe(150);
    });
});
