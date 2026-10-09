import { describe, expect, it, jest } from "@jest/globals";
import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import { render } from "@testing-library/react-native";

import type { CategoryBudgetView } from "@/data/budgets";

import { BudgetCard } from "./budget-card";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { showCents: true } }),
}));
jest.mock("@/hooks/use-over-budget-moment", () => ({ useOverBudgetMoment: () => ({}) }));
jest.mock("./budget-burndown-chart", () => ({ BudgetBurndownChart: () => null }));

const NOW = new Date("2026-07-15T12:00:00");
const HERO_TIME_LEFT = 'budgetTime.daysLeft:{"count":17}';

function transport(end: string): CategoryBudgetView {
    return {
        amount: 150,
        anchor: new Date("2026-07-01T00:00:00"),
        carry: 0,
        categoryId: "transport",
        color: "#4d84bd",
        currency: "USD",
        customName: null,
        emoji: null,
        icon: null,
        id: "transport",
        leftover: 103.9,
        limit: 150,
        name: "Transport",
        overBudget: false,
        rollover: false,
        spent: 46.1,
        type: BUDGET_TYPE.month,
        window: { end: new Date(end), start: new Date("2026-07-01T00:00:00") },
    };
}

async function renderCard(budget: CategoryBudgetView) {
    return await render(
        <BudgetCard
            budget={budget}
            contributions={[]}
            currency="USD"
            heroTimeLeft={HERO_TIME_LEFT}
            menuItems={[]}
            nowMs={NOW.getTime()}
            onPress={jest.fn()}
            width={null}
        />
    );
}

describe("budgetCard", () => {
    it("leaves out the days left the hero already shows", async () => {
        const { getByText, queryByText } = await renderCard(transport("2026-08-01T00:00:00"));

        expect(getByText(/budgets\.spentOfLimit/)).toBeTruthy();
        expect(queryByText(/budgetTime\.daysLeft/)).toBeNull();
    });
});
