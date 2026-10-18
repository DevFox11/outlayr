import { describe, expect, it, jest } from "@jest/globals";
import { RECURRING_TYPE } from "@outlayr/money/recurrence";
import { buildRateTable } from "@outlayr/money/valuation";
import { render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { LogUpcoming } from "./log-upcoming";

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true, swapTimeLabel: false, use24Hour: false }),
}));
jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", future: "#8A8578", muted: "#8A8578" }),
}));

const RENEWAL = {
    amount: 139,
    amountUsd: 139,
    categoryColor: null,
    categoryEmoji: null,
    categoryIcon: null,
    categoryId: null,
    categoryName: null,
    currency: "USD",
    customColor: null,
    date: new Date(Date.UTC(2025, 10, 20, 12)),
    day: new Date(Date.UTC(2025, 10, 20)),
    emoji: null,
    exchangeRate: 1,
    exchangeRateType: null,
    icon: null,
    id: "prime",
    imageColor: null,
    imageUri: null,
    income: false,
    note: "Amazon Prime",
    recurringAnchorDay: null,
    recurringCoefficient: 1,
    recurringEndDate: null,
    recurringType: RECURRING_TYPE.yearly,
};

describe("the upcoming section", () => {
    it("values a renewal first saved before the oldest rate held at its next charge", async () => {
        // Rates open in July; the renewal was saved last November. Valued at that
        // date nothing could convert it, and it stayed -$139.00 under a euro view.
        const { getAllByText } = await render(
            <LogUpcoming
                currency="EUR"
                menuItems={() => []}
                nowMs={Date.UTC(2026, 9, 18, 12)}
                onPress={() => {}}
                rates={buildRateTable([{ date: "2026-07-01", quote: "EUR", rate: 0.9 }])}
                schedules={[RENEWAL as never]}
                transactions={[RENEWAL as never]}
            />
        );

        expect(getAllByText("-€125.10")).toHaveLength(2);
    });
});
