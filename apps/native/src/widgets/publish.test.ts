import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import type { WidgetProps } from "./props";
import { publishWidgets } from "./publish";

/**
 * Every widget the build declares gets a fresh timeline or snapshot from one
 * publish. Removing a widget's import and its update call from `publish.ts`
 * together would pass lint and tsc and leave an installed tile stale; this is
 * the one place that notices.
 */
jest.mock("./budget", () => ({ __esModule: true, default: { updateTimeline: jest.fn() } }));
jest.mock("./insights", () => ({ __esModule: true, default: { updateSnapshot: jest.fn() } }));
jest.mock("./ledger", () => ({ __esModule: true, default: { updateSnapshot: jest.fn() } }));
jest.mock("./log", () => ({ __esModule: true, default: { updateSnapshot: jest.fn() } }));
jest.mock("@/lib/widget-bridge", () => ({ publishIntentSnapshot: jest.fn() }));

// `__esModule` on the factories, or babel's interop wraps the whole factory as `default`.
const widget = <Module extends { default: unknown }>(path: string): Module["default"] =>
    jest.requireMock<Module>(path).default;
const updates = {
    Budget: jest.mocked(widget<typeof import("./budget")>("./budget").updateTimeline),
    Insights: jest.mocked(widget<typeof import("./insights")>("./insights").updateSnapshot),
    Ledger: jest.mocked(widget<typeof import("./ledger")>("./ledger").updateSnapshot),
    Log: jest.mocked(widget<typeof import("./log")>("./log").updateSnapshot),
};

const mockProps: WidgetProps = {
    // SAFETY: only the fields publishWidgets reads on its way to the update
    // calls; the tiles never render here.
    Budget: { views: { auto: { present: false } } } as unknown as WidgetProps["Budget"],
    Insights: { defaultPeriod: "month", windows: { month: {} } } as unknown as WidgetProps["Insights"],
    Ledger: {} as WidgetProps["Ledger"],
    Log: {} as WidgetProps["Log"],
    intentBudgets: [],
};
jest.mock("./props", () => ({ buildWidgetProps: () => Promise.resolve(mockProps) }));

beforeEach(() => {
    for (const update of Object.values(updates)) {
        update.mockClear();
    }
});

describe("publishWidgets", () => {
    it("refreshes every widget the build declares", async () => {
        await publishWidgets(mockUnusedDatabase());

        expect(
            Object.fromEntries(Object.entries(updates).map(([name, update]) => [name, update.mock.calls.length]))
        ).toStrictEqual({
            Budget: 1,
            Insights: 1,
            Ledger: 1,
            Log: 1,
        });
        expect(updates.Ledger).toHaveBeenCalledWith(mockProps.Ledger);
        expect(updates.Insights).toHaveBeenCalledWith(mockProps.Insights);
        expect(updates.Log).toHaveBeenCalledWith(mockProps.Log);
    });
});
