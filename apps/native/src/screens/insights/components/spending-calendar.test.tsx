import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import type { SpendingCalendarEntry } from "@/domain/spending-calendar";
import { CHART_DRAW } from "@/theme/chart";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { SpendingCalendar } from "./spending-calendar";

const mockAnimatedCharts = jest.fn();
const mockBuildHeatmapCalendar = jest.fn((_entries: unknown[], _options: unknown) => []);
const mockReduceMotion = jest.fn();

const translations = {
    "insights.calendar.day": {
        en: "{date}, {amount} spent",
        es: "{date}, {amount} gastados",
    },
    "insights.calendar.dayApproximate": {
        en: "{date}, approximately {amount} spent",
        es: "{date}, aproximadamente {amount} gastados",
    },
    "insights.calendar.empty": {
        en: "No spending in the last six months.",
        es: "Sin gastos en los últimos seis meses.",
    },
    "insights.calendar.less": { en: "Less", es: "Menos" },
    "insights.calendar.more": { en: "More", es: "Más" },
    "insights.calendar.range": { en: "Last six months", es: "Últimos seis meses" },
    "insights.calendar.title": { en: "Spending", es: "Gastos" },
} as const;

let mockLanguage: "en" | "es" = "en";

jest.mock("panelui-native", () => {
    const Cells = jest.fn(() => null);
    const Legend = jest.fn(() => null);
    const Tooltip = jest.fn(() => null);
    const XAxis = jest.fn(() => null);
    const YAxis = jest.fn(() => null);
    const HeatmapChart = Object.assign(
        jest.fn(({ children }) => children),
        { Cells, Legend, Tooltip, XAxis, YAxis }
    );
    Object.assign(globalThis, {
        mockHeatmapChart: HeatmapChart,
        mockHeatmapLegend: Legend,
        mockHeatmapTooltip: Tooltip,
    });
    return {
        HeatmapChart,
        buildHeatmapCalendar: (entries: unknown[], options: unknown) => mockBuildHeatmapCalendar(entries, options),
    };
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
    useTranslation: () => (key: keyof typeof translations, params?: Record<string, string>) => {
        const template: string = translations[key][mockLanguage];
        return Object.entries(params ?? {}).reduce(
            (value: string, [name, replacement]) => value.replace(`{${name}}`, replacement),
            template
        );
    },
}));

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ railTrack: "#rail", tint: "#tint" }),
}));

const { mockHeatmapChart, mockHeatmapLegend, mockHeatmapTooltip } = globalThis as unknown as {
    mockHeatmapChart: jest.Mock;
    mockHeatmapLegend: jest.Mock;
    mockHeatmapTooltip: jest.Mock;
};

const NOW = new Date(2026, 7, 10, 12);
const ENTRIES: SpendingCalendarEntry[] = [{ date: "2026-08-10", exact: true, value: 12.5 }];

function renderCalendar(entries: readonly SpendingCalendarEntry[] = ENTRIES) {
    return render(<SpendingCalendar currency="USD" entries={entries} firstWeekday={2} now={NOW} showCents />);
}

beforeEach(() => {
    mockLanguage = "en";
    mockAnimatedCharts.mockReturnValue(true);
    mockBuildHeatmapCalendar.mockClear();
    mockHeatmapChart.mockClear();
    mockHeatmapLegend.mockClear();
    mockHeatmapTooltip.mockClear();
    mockReduceMotion.mockReturnValue(false);
});

describe("spendingCalendar", () => {
    it("builds a bounded calendar with the zero-based configured weekday", async () => {
        await renderCalendar();

        expect(mockBuildHeatmapCalendar).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
                end: new Date(2026, 7, 10),
                start: new Date(2026, 1, 10),
                weekStartDay: 1,
            })
        );
        expect(mockHeatmapChart.mock.calls[0]?.[0]).toStrictEqual(
            expect.objectContaining({ emptyColor: "#rail", layout: "fill", weekStartDay: 1 })
        );
    });

    it("localizes the legend and tooltip", async () => {
        mockLanguage = "es";
        await renderCalendar();

        expect(screen.getByText("Gastos · Últimos seis meses")).toBeOnTheScreen();
        expect(mockHeatmapLegend.mock.calls[0]?.[0]).toStrictEqual(
            expect.objectContaining({ lessLabel: "Menos", moreLabel: "Más" })
        );
        const tooltip = mockHeatmapTooltip.mock.calls[0]?.[0] as {
            formatLabel: (cell: { count: number; date: Date }) => string;
        };
        expect(tooltip.formatLabel({ count: 12.5, date: NOW })).toMatch(/10 ago.*\$12\.50 gastados/i);
    });

    it("owns a day-level accessibility companion and hides the PanelUI tree", async () => {
        await renderCalendar();

        const day = screen.getByLabelText(/10 Aug.*\$12\.50 spent/i);
        expect(day).toBeOnTheScreen();
        expect(day.props.style).toStrictEqual(expect.objectContaining({ flex: 1 }));
        expect(screen.getAllByLabelText(/spent$/i)).toHaveLength(1);
        const companion = screen.getByTestId("spending-calendar-accessibility-grid");
        expect(companion.props.pointerEvents).toBe("none");
        expect(companion.props.style).toStrictEqual(
            expect.objectContaining({ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 })
        );
        expect(companion.props.style).not.toStrictEqual(expect.objectContaining({ opacity: 0 }));
        expect(
            screen.getByTestId("spending-calendar-panel-chart", { includeHiddenElements: true }).props
        ).toMatchObject({
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants",
        });
    });

    it("exposes a zero-valued entry but not synthesized empty days", async () => {
        await renderCalendar([{ date: "2026-08-10", exact: true, value: 0 }]);

        expect(screen.getByLabelText(/10 Aug.*\$0\.00 spent/i)).toBeOnTheScreen();
        expect(screen.queryByLabelText(/9 Aug.*spent/i)).not.toBeOnTheScreen();
        expect(screen.getAllByLabelText(/spent$/i)).toHaveLength(1);
    });

    it("renders a localized empty state without empty day focus stops", async () => {
        mockLanguage = "es";
        await renderCalendar([]);

        expect(screen.getByText("Gastos")).toBeOnTheScreen();
        expect(screen.getByText("Sin gastos en los últimos seis meses.")).toBeOnTheScreen();
        expect(screen.queryAllByLabelText(/gastados$/i)).toHaveLength(0);
    });

    it("labels partially valued days as approximate in the current language", async () => {
        mockLanguage = "es";
        await renderCalendar([{ date: "2026-08-10", exact: false, value: 12.5 }]);

        expect(screen.getByLabelText(/aproximadamente.*\$12\.50 gastados/i)).toBeOnTheScreen();
        const tooltip = mockHeatmapTooltip.mock.calls[0]?.[0] as {
            formatLabel: (cell: { count: number; date: Date }) => string;
        };
        expect(tooltip.formatLabel({ count: 12.5, date: NOW })).toMatch(/aproximadamente.*\$12\.50 gastados/i);
    });

    it.each([
        [false, false],
        [true, true],
    ])(
        "disables the reveal when animatedCharts is %s and reduced motion is %s",
        async (animatedCharts, reducedMotion) => {
            mockAnimatedCharts.mockReturnValue(animatedCharts);
            mockReduceMotion.mockReturnValue(reducedMotion);

            await renderCalendar();

            expect(mockHeatmapChart.mock.calls[0]?.[0]).toStrictEqual(
                expect.objectContaining({ animationDuration: 0 })
            );
        }
    );

    it("uses the shared reveal duration when both motion controls allow animation", async () => {
        mockAnimatedCharts.mockReturnValue(true);
        mockReduceMotion.mockReturnValue(false);

        await renderCalendar();

        expect(mockHeatmapChart.mock.calls[0]?.[0]).toStrictEqual(
            expect.objectContaining({ animationDuration: CHART_DRAW.durationMs })
        );
    });
});
