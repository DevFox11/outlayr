import { describe, expect, it, jest } from "@jest/globals";
import type { ExpenseContribution } from "@outlayr/money/budget-spent";
import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import { render } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { CategoryBudgetView } from "@/data/budgets";

import { BudgetRow } from "./budget-row";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => ({ state: { showCents: true } }),
    useSettingBool: () => false,
}));
jest.mock("@/hooks/use-over-budget-moment", () => ({ useOverBudgetMoment: () => ({}) }));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
jest.mock("./budget-progress-bar", () => {
    const { View } = require("react-native");
    return { BudgetProgressBar: () => <View testID="rail" /> };
});

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

async function renderRow(budget: CategoryBudgetView, contributions: readonly ExpenseContribution[] = []) {
    return await render(
        <BudgetRow
            budget={budget}
            contributions={contributions}
            currency="USD"
            heroTimeLeft={HERO_TIME_LEFT}
            nowMs={NOW.getTime()}
            onDelete={jest.fn()}
            onPress={jest.fn()}
        />,
        { wrapper: GestureHandlerRootView }
    );
}

describe("budgetRow", () => {
    it("leaves out the days left the hero already shows", async () => {
        const { getByText, queryByText } = await renderRow(transport("2026-08-01T00:00:00"));

        expect(getByText(/budgets\.spentOfLimit/)).toBeTruthy();
        expect(queryByText(/budgetTime\.daysLeft/)).toBeNull();
    });

    it("keeps its own days left when its window ends on another day", async () => {
        const { getByText } = await renderRow(transport("2026-07-20T00:00:00"));

        expect(getByText(/budgetTime\.daysLeft:\{"count":5\}/)).toBeTruthy();
    });

    it("draws a day budget as the day's purchases in its category colour, and as the rail with none to draw", async () => {
        const day: CategoryBudgetView = {
            ...transport("2026-07-16T00:00:00"),
            amount: 20,
            leftover: 15,
            limit: 20,
            spent: 5,
            type: BUDGET_TYPE.day,
            window: { end: new Date("2026-07-16T00:00:00"), start: new Date("2026-07-15T00:00:00") },
        };
        const { queryByTestId, toJSON } = await renderRow(day, [
            { amount: 5, categoryId: "transport", date: new Date("2026-07-15T09:00:00"), parentId: null },
            { amount: 20, categoryId: "transport", date: new Date("2026-07-15T10:00:00"), parentId: null },
        ]);
        const tree = JSON.stringify(toJSON());

        expect(queryByTestId("rail")).toBeNull();
        expect(tree).toContain('"width":"20%"');
        expect(tree.match(/"backgroundColor":"#4d84bd"/g)).toHaveLength(1);

        const untouched = await renderRow({ ...day, leftover: 20, spent: 0 }, []);
        expect(untouched.getByTestId("rail")).toBeTruthy();
    });
});
