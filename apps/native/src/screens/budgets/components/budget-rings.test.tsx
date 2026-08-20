import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import type { CategoryBudgetView } from "@/data/budgets";

import { BudgetRings } from "./budget-rings";

const mockAnimatedCharts = jest.fn();
const mockReduceMotion = jest.fn();
const mockTranslations = {
    "budgets.rings.heading": { en: "Category progress", es: "Progreso por categoría" },
    "budgets.rings.over": { en: "{amount} over budget", es: "{amount} excedido" },
    "budgets.rings.rowA11y": {
        en: "{name}, {percent}% spent, {spent} of {limit}",
        es: "{name}, {percent}% gastado, {spent} de {limit}",
    },
    "budgets.rings.rowA11yOver": {
        en: "{name}, {percent}% spent, {amount} over budget",
        es: "{name}, {percent}% gastado, {amount} excedido",
    },
    "budgets.rings.summary": {
        en: "Category budgets ranked by urgency.",
        es: "Presupuestos por categoría ordenados por urgencia.",
    },
    "budgets.spentOfLimit": { en: "{spent} of {limit}", es: "{spent} de {limit}" },
} as const;

let mockLanguage: "en" | "es" = "en";

jest.mock("panelui-native", () => {
    const { Text: NativeText } = jest.requireActual("react-native") as typeof import("react-native");
    const Center = jest.fn(({ children }: { children?: (ring: null) => import("react").ReactNode }) =>
        children ? children(null) : <NativeText>PanelUI default: of target</NativeText>
    );
    const RingChart = Object.assign(
        jest.fn(({ children }) => children),
        {
            Center,
            Ring: jest.fn(() => null),
        }
    );
    Object.assign(globalThis, { mockBudgetRingChart: RingChart });
    return { RingChart };
});

jest.mock("react-native-reanimated", () => {
    const actual = jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
    return { ...actual, useReducedMotion: () => mockReduceMotion() };
});

jest.mock("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true }),
    useSettingBool: () => mockAnimatedCharts(),
}));

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: mockLanguage }),
    useTranslation: () => (key: keyof typeof mockTranslations, params?: Record<string, string | number>) => {
        const template: string = mockTranslations[key][mockLanguage];
        return Object.entries(params ?? {}).reduce(
            (value: string, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
            template
        );
    },
}));

const { mockBudgetRingChart } = globalThis as unknown as {
    mockBudgetRingChart: jest.Mock;
};

function budget(
    id: string,
    name: string,
    amount: number,
    spent: number,
    overrides: Partial<CategoryBudgetView> = {}
): CategoryBudgetView {
    return {
        amount,
        anchor: new Date(2026, 0, 1),
        carry: 0,
        categoryId: `category-${id}`,
        color: id === "food" ? "#ff0000" : "#0000ff",
        currency: null,
        customName: null,
        emoji: null,
        icon: null,
        id,
        leftover: amount - spent,
        limit: amount,
        name,
        overBudget: spent > amount,
        rollover: false,
        spent,
        type: 2,
        window: {
            end: new Date("2026-09-01T00:00:00Z"),
            start: new Date("2026-08-01T00:00:00Z"),
        },
        ...overrides,
    };
}

const FOOD = budget("food", "Food", 100, 150);
const TRAVEL = budget("travel", "Travel", 200, 50);

beforeEach(() => {
    mockLanguage = "en";
    mockAnimatedCharts.mockReturnValue(true);
    mockBudgetRingChart.mockClear();
    mockReduceMotion.mockReturnValue(false);
});

describe("budgetRings", () => {
    it("keeps selection by ID when live severity order changes", async () => {
        const { rerender } = await render(<BudgetRings budgets={[FOOD, TRAVEL]} currency="USD" />);
        let chartProps = mockBudgetRingChart.mock.calls.at(-1)?.[0] as {
            activeIndex: number;
            onActiveIndexChange: (index: number) => void;
        };

        await fireEvent.press(screen.getByRole("button", { name: /travel/i }));
        await rerender(<BudgetRings budgets={[TRAVEL, FOOD]} currency="USD" />);

        chartProps = mockBudgetRingChart.mock.calls.at(-1)?.[0] as typeof chartProps;
        expect(chartProps.activeIndex).toBe(0);
        expect(screen.getByRole("button", { name: /travel/i }).props.accessibilityState).toMatchObject({
            selected: true,
        });
    });

    it("clears a selected ID when that budget leaves the live ring set", async () => {
        const { rerender } = await render(<BudgetRings budgets={[FOOD, TRAVEL]} currency="USD" />);
        const chartProps = mockBudgetRingChart.mock.calls.at(-1)?.[0] as {
            onActiveIndexChange: (index: number) => void;
        };
        await act(() => chartProps.onActiveIndexChange(1));

        await rerender(<BudgetRings budgets={[FOOD]} currency="USD" />);
        await rerender(<BudgetRings budgets={[FOOD, TRAVEL]} currency="USD" />);

        const latestChartProps = mockBudgetRingChart.mock.calls.at(-1)?.[0] as { activeIndex: number } | undefined;
        expect(latestChartProps?.activeIndex).toBe(-1);
        expect(screen.getByRole("button", { name: /travel/i }).props.accessibilityState).toMatchObject({
            selected: false,
        });
    });

    it("owns localized accessible legend rows and hides PanelUI output", async () => {
        mockLanguage = "es";
        await render(<BudgetRings budgets={[FOOD, TRAVEL]} currency="USD" />);

        expect(screen.getByText("Progreso por categoría")).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: /food, 150% gastado, 50,00\s\$ excedido/i })).toBeOnTheScreen();
        expect(screen.getByTestId("budget-rings-panel-chart", { includeHiddenElements: true }).props).toMatchObject({
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants",
        });
    });

    it("replaces PanelUI's default English center with localized visible output", async () => {
        mockLanguage = "es";
        await render(<BudgetRings budgets={[FOOD]} currency="USD" />);

        expect(screen.queryByText("PanelUI default: of target", { includeHiddenElements: true })).not.toBeOnTheScreen();
        expect(screen.getByText("150,00\u00A0$", { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it("shows uncapped percentage and explicit over-budget copy", async () => {
        await render(<BudgetRings budgets={[FOOD]} currency="USD" />);

        expect(screen.getByText("150%")).toBeOnTheScreen();
        expect(screen.getByText("$50.00 over budget")).toBeOnTheScreen();
    });

    it.each([
        [false, false],
        [true, true],
    ])(
        "disables ring animation when animatedCharts is %s and reduced motion is %s",
        async (animatedCharts, reducedMotion) => {
            mockAnimatedCharts.mockReturnValue(animatedCharts);
            mockReduceMotion.mockReturnValue(reducedMotion);
            await render(<BudgetRings budgets={[FOOD]} currency="USD" />);

            expect(mockBudgetRingChart.mock.calls.at(-1)?.[0]).toStrictEqual(
                expect.objectContaining({ animationDuration: 0 })
            );
        }
    );
});
