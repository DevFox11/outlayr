import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CurrencyCell } from "@outlayr/money/currency-totals";
import { buildRateTable } from "@outlayr/money/valuation";
import { render, screen } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { AccountBalanceChart } from "./account-balance-chart";

const mockAnimatedCharts = jest.fn();
const mockReduceMotion = jest.fn();
const mockTranslations = {
    "accounts.chart.approximate": { en: "Approximate", es: "Aproximado" },
    "accounts.chart.heading": { en: "Balance history", es: "Historial del saldo" },
    "accounts.chart.summary": {
        en: "Balance history. {amount} on {date}.",
        es: "Historial del saldo. {amount} el {date}.",
    },
    "accounts.chart.summaryApproximate": {
        en: "Balance history. Approximately {amount} on {date}.",
        es: "Historial del saldo. Aproximadamente {amount} el {date}.",
    },
} as const;

let mockLanguage: "en" | "es" = "en";

jest.mock("panelui-native", () => {
    const Tooltip = jest.fn(() => null);
    const XAxis = jest.fn(() => null);
    const mockYAxis = jest.fn(() => null);
    const LineChart = Object.assign(
        jest.fn(({ children }) => children),
        {
            Area: jest.fn(() => null),
            Grid: jest.fn(() => null),
            Line: jest.fn(() => null),
            Tooltip,
            XAxis,
            YAxis: mockYAxis,
        }
    );
    Object.assign(globalThis, {
        mockLineChart: LineChart,
        mockLineChartTooltip: Tooltip,
        mockLineChartXAxis: XAxis,
        mockLineChartYAxis: mockYAxis,
    });
    return { LineChart };
});

jest.mock("react-native-reanimated", () => {
    const actual = jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
    return { ...actual, useReducedMotion: () => mockReduceMotion() };
});

jest.mock("@/contexts/display-settings-context", () => ({
    useSettingBool: () => mockAnimatedCharts(),
}));

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: mockLanguage }),
    useTranslation: () => (key: keyof typeof mockTranslations, params?: Record<string, string>) => {
        const template: string = mockTranslations[key][mockLanguage];
        return Object.entries(params ?? {}).reduce(
            (value: string, [name, replacement]) => value.replace(`{${name}}`, replacement),
            template
        );
    },
}));

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ tint: "#4f46e5" }),
}));

const { mockLineChart, mockLineChartTooltip, mockLineChartXAxis, mockLineChartYAxis } = globalThis as unknown as {
    mockLineChart: jest.Mock;
    mockLineChartTooltip: jest.Mock;
    mockLineChartXAxis: jest.Mock;
    mockLineChartYAxis: jest.Mock;
};

const NOW = new Date("2026-08-10T12:00:00Z");
const RATES = buildRateTable([]);

function cell(overrides: Partial<CurrencyCell> = {}): CurrencyCell {
    return {
        amount: 0,
        amountUsd: 0,
        count: 1,
        currencyCode: "USD",
        dateKey: "2026-08-10",
        income: true,
        unconvertedAmount: 0,
        unconvertedCount: 0,
        ...overrides,
    };
}

function renderChart(
    cells: readonly CurrencyCell[] = [],
    initialBalance = 0,
    currency = "USD",
    initialBalanceDate = new Date("2026-08-01T12:00:00Z")
) {
    return render(
        <AccountBalanceChart
            account={{
                currency,
                initialBalance,
                initialBalanceDate,
            }}
            cells={cells}
            now={NOW}
            rates={RATES}
            showCents
        />
    );
}

beforeEach(() => {
    mockLanguage = "en";
    mockAnimatedCharts.mockReturnValue(true);
    mockLineChart.mockClear();
    mockLineChartTooltip.mockClear();
    mockLineChartXAxis.mockClear();
    mockLineChartYAxis.mockClear();
    mockReduceMotion.mockReturnValue(false);
});

describe("accountBalanceChart", () => {
    it("centers a bounded domain around a non-zero flat balance", async () => {
        await renderChart([], 20, "USD", new Date("2026-01-01T12:00:00Z"));

        const props = mockLineChart.mock.calls[0]?.[0] as { yDomain: [number, number] };
        expect(props.yDomain).toStrictEqual([18, 22]);
    });

    it("uses compact magnitudes for four-digit negative Y-axis labels", async () => {
        await renderChart([], -1177, "USD", new Date("2026-01-01T12:00:00Z"));

        const props = mockLineChartYAxis.mock.calls.at(-1)?.[0] as { format: (value: number) => string };
        expect(props.format(-1177)).toBe("-1.2k");
        expect(props.format(-1177)).not.toContain("1,177");
        const tooltip = mockLineChartTooltip.mock.calls.at(-1)?.[0] as { formatValue: (value: number) => string };
        expect(tooltip.formatValue(-1177)).toBe("-$1,177.00");
        expect(screen.getByTestId("account-balance-summary").props.accessibilityLabel).toContain("-$1,177.00");
    });

    it("localizes the summary outside the PanelUI accessibility subtree", async () => {
        mockLanguage = "es";
        await renderChart([], 20);

        expect(screen.getByLabelText(/historial del saldo/i)).toBeOnTheScreen();
        expect(screen.getByTestId("account-balance-summary").props.accessibilityLabel).toMatch(
            /historial del saldo\. \$20\.00 el 10 ago\./i
        );
        expect(screen.getByTestId("account-balance-panel-chart", { includeHiddenElements: true }).props).toMatchObject({
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants",
        });
    });

    it("includes a transfer-only balance movement in the rendered series", async () => {
        await renderChart([cell({ amount: 40, amountUsd: 40, income: true })]);

        const props = mockLineChart.mock.calls[0]?.[0] as { data: { value: number }[] };
        expect(props.data.at(-1)).toMatchObject({ value: 40 });
    });

    it("uses one local calendar for date labels at a UTC boundary", async () => {
        const previousTimezone = process.env.TZ;
        process.env.TZ = "Pacific/Kiritimati";

        try {
            await renderChart();
            const props = mockLineChartXAxis.mock.calls[0]?.[0] as {
                format: (datum: { date: string }) => string;
            };

            expect(props.format({ date: "2026-01-31" })).toBe("31 Jan");
        } finally {
            if (previousTimezone === undefined) {
                delete process.env.TZ;
            } else {
                process.env.TZ = previousTimezone;
            }
        }
    });

    it("announces and displays an approximate marker for inexact valuation", async () => {
        await renderChart(
            [cell({ amount: 7, amountUsd: 10, currencyCode: "EUR", unconvertedAmount: 7, unconvertedCount: 1 })],
            20
        );

        expect(screen.getByLabelText(/approximately/i)).toBeOnTheScreen();
        const chartProps = mockLineChart.mock.calls[0]?.[0] as { data: { exact: number }[] };
        expect(chartProps.data.at(-1)).toMatchObject({ exact: 0 });
        const tooltipProps = mockLineChartTooltip.mock.calls[0]?.[0] as {
            formatX: (datum: { date: string; exact: number }) => string;
        };
        expect(tooltipProps.formatX({ date: "2026-08-10", exact: 0 })).toMatch(/approximate/i);
    });

    it.each([
        [false, false],
        [true, true],
    ])(
        "disables the reveal when animatedCharts is %s and reduced motion is %s",
        async (animatedCharts, reducedMotion) => {
            mockAnimatedCharts.mockReturnValue(animatedCharts);
            mockReduceMotion.mockReturnValue(reducedMotion);

            await renderChart();

            expect(mockLineChart.mock.calls[0]?.[0]).toStrictEqual(
                expect.objectContaining({ animationDuration: 0, domainDuration: 0 })
            );
        }
    );
});
