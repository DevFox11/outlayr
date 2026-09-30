import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import type { TransferMove } from "@/domain/transfer-log-rows";
import { buildRateTable } from "@/domain/valuation";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionRow } from "./transaction-row";

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true, swapTimeLabel: false, use24Hour: false }),
}));
jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => {
    const { EN } = require("@/i18n/catalog") as typeof import("@/i18n/catalog");
    const { translate } = require("@/i18n/translate") as typeof import("@/i18n/translate");
    return {
        useLanguage: () => ({ language: "en" }),
        useTranslation: () => (key, params) =>
            /^log\.row\.(arrived|amountTransfer|outside)/.test(key)
                ? translate(key, { catalog: EN, fallback: EN, params })
                : key,
    };
});
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            foreground: "#17150F",
            future: "#8A8578",
            income: "#3D7A5C",
            muted: "#8A8578",
            surfaceSecondary: "#F7F5EF",
            transfer: "#427AA1",
        }),
}));

const PENDING_CUSTOM = {
    amount: 100,
    amountUsd: null,
    categoryColor: null,
    categoryEmoji: null,
    categoryIcon: null,
    categoryId: "category-1",
    categoryName: "Shopping",
    currency: "VES",
    customColor: null,
    date: new Date("2026-08-10T12:00:00.000Z"),
    day: new Date("2026-08-10T00:00:00.000Z"),
    emoji: null,
    exchangeRate: null,
    exchangeRateType: "custom",
    icon: null,
    id: "pending-1",
    imageColor: null,
    imageUri: null,
    income: false,
    note: "Market purchase",
    recurringCoefficient: 1,
    recurringEndDate: null,
    recurringType: 0,
};

describe("transactionRow", () => {
    it("shows an accessible Rate needed badge for the derived pending custom triple", async () => {
        const { getByLabelText, getByText } = await render(
            <TransactionRow currency="USD" onPress={() => {}} transaction={PENDING_CUSTOM as never} />
        );

        expect(getByText("log.row.rateNeeded")).toBeTruthy();
        expect(getByLabelText("log.row.rateNeededAccessibility")).toBeTruthy();
    });

    it("reads the unplaced badge through a row that has no label of its own", async () => {
        const { getByLabelText, getByRole } = await render(
            <TransactionRow
                currency="EUR"
                onPress={() => {}}
                rates={buildRateTable([])}
                transaction={{ ...PENDING_CUSTOM, currency: null, exchangeRateType: null } as never}
            />
        );

        expect(getByLabelText("log.row.unplaced")).toBeTruthy();
        expect(getByRole("button").props.accessibilityLabel).toBeUndefined();
    });
});

describe("a transfer's row", () => {
    const TRANSFER = {
        ...PENDING_CUSTOM,
        amount: 98,
        categoryId: null,
        categoryName: null,
        currency: "USD",
        exchangeRateType: null,
        id: "move",
        note: "Chase → Ally Savings",
        transferId: "move",
    };
    const moved = {
        arrived: 98,
        arrivedCurrency: "USD",
        fee: { amount: 2, currency: "USD" },
        outside: null,
        sent: 100,
    };
    const drawn = (move: TransferMove) =>
        render(
            <TransactionRow currency="USD" onPress={() => {}} transaction={{ ...TRANSFER, moved: move } as never} />
        );

    it("leads with what left and states the arrival and the fee under it, in words too", async () => {
        const { getByLabelText, getByText } = await drawn(moved);

        expect(getByText("$100.00")).toBeTruthy();
        expect(getByLabelText("$100.00 moved")).toBeTruthy();
        expect(getByText("$98.00 arrived · $2.00 fee")).toBeTruthy();
        expect(getByLabelText("$98.00 arrived after a $2.00 fee")).toBeTruthy();
    });

    it("states the arrival of a feeless move only when it landed in another currency", async () => {
        const crossed = await drawn({ arrived: 42_427.29, arrivedCurrency: "VES", fee: null, outside: null, sent: 50 });
        expect(crossed.getByText("Bs.42,427.29 arrived")).toBeTruthy();

        const level = await drawn({ ...moved, fee: null, sent: 98 });
        expect(level.queryByText(/arrived/)).toBeNull();
    });

    it("adds what came from an untracked account on its own line", async () => {
        const { getByText } = await drawn({
            arrived: 157_471.66,
            arrivedCurrency: "VES",
            fee: { amount: 7.34, currency: "USD" },
            outside: { amount: 11.87, currency: "USD" },
            sent: 160,
        });

        expect(getByText("Bs.157,471.66 arrived · $7.34 fee")).toBeTruthy();
        expect(getByText("$11.87 from another account")).toBeTruthy();
    });
});
