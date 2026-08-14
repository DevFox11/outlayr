import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionRow } from "./transaction-row";

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true, swapTimeLabel: false, use24Hour: false }),
}));
jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
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
            <TransactionRow
                currency="USD"
                onLongPress={() => {}}
                onPress={() => {}}
                transaction={PENDING_CUSTOM as never}
            />
        );

        expect(getByText("log.row.rateNeeded")).toBeTruthy();
        expect(getByLabelText("log.row.rateNeededAccessibility")).toBeTruthy();
    });
});
