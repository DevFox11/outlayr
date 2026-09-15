import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import type { TransactionWithCategory } from "@/data/transactions";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";
import type { CurrencyCell } from "@/domain/currency-totals";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { AccountDetail } from "./detail";

const AUG_9 = new Date(2026, 7, 9, 12);

const mockPush = jest.fn();

jest.mock("expo-router", () => {
    const Noop = () => null;
    return {
        Stack: Object.assign(Noop, {
            Header: Noop,
            Screen: Object.assign(Noop, { BackButton: Noop, Title: Noop }),
            Toolbar: Object.assign(Noop, { Button: Noop }),
        }),
        useRouter: () => ({ back: jest.fn(), push: mockPush }),
    };
});

interface StubSectionListProps {
    ListEmptyComponent: React.ReactNode;
    ListHeaderComponent: React.ReactNode;
    renderItem: (info: { item: { id: string } }) => React.ReactNode;
    renderSectionHeader: (info: { section: { data: { id: string }[]; day: Date } }) => React.ReactNode;
    sections: { data: { id: string }[]; day: Date }[];
}

// The real list measures before it renders a row, and jest has no layout pass.
jest.mock("@legendapp/list/section-list", () => {
    const { View } = require("react-native");
    return {
        SectionList: ({
            sections,
            renderItem,
            renderSectionHeader,
            ListEmptyComponent,
            ListHeaderComponent,
        }: StubSectionListProps) => (
            <View>
                {ListHeaderComponent}
                {sections.length === 0 ? ListEmptyComponent : null}
                {sections.map((section) => (
                    <View key={section.day.getTime()}>
                        {renderSectionHeader({ section })}
                        {section.data.map((item) => (
                            <View key={item.id}>{renderItem({ item })}</View>
                        ))}
                    </View>
                ))}
            </View>
        ),
    };
});

// uniwind resolves the theme variables through the native runtime, which jest has none of.
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true, swapTimeLabel: false, use24Hour: false }),
    useSettingBool: () => false,
}));

const mockTransactions = jest.fn();
const mockTransfers = jest.fn();
const mockUseAccountBalance = jest.fn((_db: unknown, _account: unknown) => ({ exact: true, total: 40 }));
const mockUseAccountBalanceDetails = jest.fn((_db: unknown, _account: unknown) => ({
    balance: { exact: true, total: 40 },
    cells: [...mockTransactionCells, ...mockTransferCells],
    rates: undefined,
}));
const mockUseAccountCells = jest.fn((_db: unknown, _accountId: string) => [
    ...mockTransactionCells,
    ...mockTransferCells,
]);
const mockUseValuationIn = jest.fn((_db: unknown, _currency: string) => ({
    displayCurrency: "USD",
    rates: undefined,
}));
let mockTransactionCells: CurrencyCell[] = [];
let mockTransferCells: CurrencyCell[] = [];

jest.mock("@/data/accounts", () => ({
    useAccountBalance: (db: unknown, account: unknown) => mockUseAccountBalance(db, account),
    useAccountBalanceDetails: (db: unknown, account: unknown) => mockUseAccountBalanceDetails(db, account),
    useAccountCells: (db: unknown, accountId: string) => mockUseAccountCells(db, accountId),
    useAccountTransactions: () => mockTransactions(),
    useAccounts: () => [
        {
            currency: "USD",
            id: "savings",
            initialBalance: 0,
            initialBalanceDate: new Date(2026, 7, 9, 12),
            name: "Savings",
        },
    ],
}));

jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ pendingId: null, requestDelete: jest.fn() }),
}));

jest.mock("@/data/account-transfers", () => ({
    useAccountTransfers: () => mockTransfers(),
}));

jest.mock("@/data/use-valuation", () => ({
    useValuationIn: (db: unknown, currency: string) => mockUseValuationIn(db, currency),
}));

function transaction(id: string, note: string, amount = 12): TransactionWithCategory {
    return {
        amount,
        amountUsd: amount,
        categoryColor: null,
        categoryEmoji: null,
        categoryIcon: null,
        categoryId: null,
        categoryName: null,
        currency: "USD",
        customColor: null,
        date: AUG_9,
        day: AUG_9,
        emoji: null,
        exchangeRate: null,
        exchangeRateType: null,
        icon: null,
        id,
        imageColor: null,
        imageUri: null,
        income: false,
        note,
        recurringAnchorDay: null,
        recurringCoefficient: 1,
        recurringEndDate: null,
        recurringType: 0,
    };
}

function transfer(id: string, note: string) {
    return {
        amount: 40,
        amountUsd: 40,
        categoryColor: null,
        categoryEmoji: null,
        categoryIcon: null,
        categoryId: null,
        categoryName: null,
        currency: "USD",
        customColor: null,
        date: AUG_9,
        day: AUG_9,
        emoji: null,
        excludedFromTotals: true as const,
        icon: null,
        id,
        imageColor: null,
        imageUri: null,
        income: false,
        note,
        recurringAnchorDay: null,
        recurringCoefficient: 1,
        recurringEndDate: null,
        recurringType: 0,
        transferId: id,
        transferTo: null,
    };
}

function setTransactions(rows: TransactionWithCategory[]) {
    mockTransactions.mockReturnValue(rows);
    mockTransactionCells = rows.map((row) => ({
        amount: row.amount,
        amountUsd: row.amountUsd ?? 0,
        count: 1,
        currencyCode: row.currency,
        dateKey: "2026-08-09",
        income: row.income,
        unconvertedAmount: row.amountUsd === null ? row.amount : 0,
        unconvertedCount: row.amountUsd === null ? 1 : 0,
    }));
}

function setTransfers(rows: ReturnType<typeof transfer>[], income: boolean) {
    mockTransfers.mockReturnValue(rows);
    mockTransferCells = rows.map((row) => ({
        amount: row.amount,
        amountUsd: row.amountUsd,
        count: 1,
        currencyCode: row.currency,
        dateKey: "2026-08-09",
        income,
        unconvertedAmount: 0,
        unconvertedCount: 0,
    }));
}

beforeEach(() => {
    mockPush.mockClear();
    mockUseAccountBalance.mockClear();
    mockUseAccountBalanceDetails.mockClear();
    mockUseAccountCells.mockClear();
    mockUseValuationIn.mockClear();
    setTransactions([]);
    setTransfers([], false);
});

describe("an account's history", () => {
    it("shares one cells-and-rates snapshot between the balance and chart", async () => {
        await render(<AccountDetail id="savings" />);

        expect(mockUseAccountBalanceDetails).toHaveBeenCalledTimes(1);
        expect(mockUseAccountBalance).not.toHaveBeenCalled();
        expect(mockUseAccountCells).not.toHaveBeenCalled();
        expect(mockUseValuationIn).not.toHaveBeenCalled();
    });

    it("lists a transfer that moved money into the account", async () => {
        setTransfers([transfer("tr1", "Checking → Savings")], true);

        const { getByText } = await render(<AccountDetail id="savings" />);

        getByText("Checking → Savings");
    });

    it("lists a transfer that moved money out of the account", async () => {
        setTransfers([transfer("tr1", "Savings → Checking")], false);

        const { getByText } = await render(<AccountDetail id="savings" />);

        getByText("Savings → Checking");
    });

    it("stands the empty state down when the only history is a transfer", async () => {
        setTransfers([transfer("tr1", "Checking → Savings")], true);

        const { queryByText } = await render(<AccountDetail id="savings" />);

        expect(queryByText("accounts.detail.empty")).toBeNull();
    });

    it("still says nothing is attached when there is neither a transaction nor a transfer", async () => {
        const { getByText } = await render(<AccountDetail id="savings" />);

        getByText("accounts.detail.empty");
    });

    it("leaves the day's total to the transactions around the transfer", async () => {
        setTransactions([transaction("t1", "Coffee"), transaction("t2", "Bus", 8)]);
        setTransfers([transfer("tr1", "Checking → Savings")], true);

        const { getByText } = await render(<AccountDetail id="savings" />);

        getByText("-$20.00");
    });

    it("opens the transfer behind a transfer row, not a transaction that does not exist", async () => {
        setTransfers([transfer("tr1", "Checking → Savings")], true);

        const { getByText } = await render(<AccountDetail id="savings" />);
        await fireEvent.press(getByText("Checking → Savings"));

        expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/tr1");
    });

    it("opens the transaction behind an ordinary row", async () => {
        setTransactions([transaction("t1", "Coffee")]);

        const { getByText } = await render(<AccountDetail id="savings" />);
        await fireEvent.press(getByText("Coffee"));

        expect(mockPush).toHaveBeenCalledWith("/transactions/t1");
    });
});
