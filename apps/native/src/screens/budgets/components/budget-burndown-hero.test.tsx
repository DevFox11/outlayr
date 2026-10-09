import { describe, expect, it, jest } from "@jest/globals";
import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import { render } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { MainBudgetView } from "@/data/budgets";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { BudgetBurndownHero } from "./budget-burndown-hero";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { showCents: true } }),
}));
jest.mock("./budget-burndown-chart", () => ({ BudgetBurndownChart: () => null }));

const NOW = new Date("2026-07-15T12:00:00");

function carriedBudget(): MainBudgetView {
    return {
        amount: 620,
        anchor: new Date("2026-07-01T00:00:00"),
        carry: 120,
        currency: "USD",
        customName: null,
        id: "main",
        leftover: 20,
        limit: 500,
        name: "Overall",
        overBudget: false,
        periodsBack: 0,
        rollover: true,
        spent: 600,
        type: BUDGET_TYPE.month,
        window: { end: new Date("2026-08-01T00:00:00"), start: new Date("2026-07-01T00:00:00") },
    } as MainBudgetView;
}

describe("budgetBurndownHero", () => {
    it("states the limit the window actually runs on, carry included", async () => {
        const { queryByText } = await render(
            <BudgetBurndownHero
                budget={carriedBudget()}
                burndown={null}
                contributions={[]}
                currency="USD"
                dominant={null}
                nowMs={NOW.getTime()}
                onPress={jest.fn()}
            />,
            { wrapper: GestureHandlerRootView }
        );

        expect(queryByText("$620")).toBeTruthy();
        expect(queryByText("$500")).toBeNull();
    });
});
