import { describe, expect, it, jest } from "@jest/globals";
import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import { act, fireEvent, render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { BudgetEditor } from "./budget-editor";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
const mockHaptic = jest.fn();

jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => mockHaptic,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", income: "#00714A", muted: "#8A8578", subtle: "#8A8578" }),
}));
jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: false }),
}));
const mockDatePickerProps: Record<string, unknown>[] = [];

jest.mock("@expo/ui/swift-ui", () => {
    const { View: RNView } = require("react-native");
    return {
        DatePicker: (props: Record<string, unknown>) => {
            mockDatePickerProps.push(props);
            return null;
        },
        HStack: RNView,
        Host: RNView,
        Spacer: RNView,
    };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
    datePickerStyle: () => ({}),
    frame: () => ({}),
    labelsHidden: () => ({}),
}));

const BASE = {
    amount: 400,
    calendar: { firstDayOfMonth: 1, firstWeekday: 1 },
    carry: 0,
    currency: "USD",
    limit: 400,
    name: null,
    namePlaceholder: "Groceries",
    nowMs: new Date(2026, 7, 20).getTime(),
    rollover: false,
    startDate: new Date(2026, 7, 1),
    type: BUDGET_TYPE.month,
};

describe("the budget editor", () => {
    it("states the window a carry made, rather than only the limit that was set", async () => {
        const { getByText } = await render(
            <BudgetEditor {...BASE} amount={452} carry={52} onChange={jest.fn()} onChangeLimit={jest.fn()} />
        );

        expect(getByText(/budgets\.editor\.limitCarry.*452.*52/)).toBeTruthy();
    });

    it("hands the limit to the sheet rather than editing it in place", async () => {
        const onChangeLimit = jest.fn();
        const { getByText } = await render(
            <BudgetEditor {...BASE} onChange={jest.fn()} onChangeLimit={onChangeLimit} />
        );

        fireEvent(getByText("budgets.editor.limit"), "click");

        expect(onChangeLimit).toHaveBeenCalledTimes(1);
    });

    it("commits one fact and names no other", async () => {
        const onChange = jest.fn();
        const { getByLabelText } = await render(
            <BudgetEditor {...BASE} onChange={onChange} onChangeLimit={jest.fn()} />
        );

        fireEvent(getByLabelText("budgets.editor.carry"), "valueChange", true);

        expect(onChange).toHaveBeenCalledWith({ rollover: true });
    });

    it("will not let the anchor be set in the future", async () => {
        // A future anchor leaves the budget reporting a window it is not in yet,
        // and ignoring everything spent until then: `advanceBudgetWindow` has
        // nothing to roll forward.
        mockDatePickerProps.length = 0;
        const { getByText } = await render(<BudgetEditor {...BASE} onChange={jest.fn()} onChangeLimit={jest.fn()} />);

        await act(() => {
            fireEvent(getByText("budgets.editor.from"), "click");
        });

        const range = mockDatePickerProps.at(-1)?.range as { end: Date; start: Date };
        expect(range.end.getTime()).toBe(BASE.nowMs);
        // The anchor it already runs on stays reachable.
        expect(range.start.getTime()).toBeLessThanOrEqual(BASE.startDate.getTime());
    });

    it("keeps a name the user typed and then tapped away from", async () => {
        const onChange = jest.fn();
        const { getByText, getByPlaceholderText } = await render(
            <BudgetEditor {...BASE} onChange={onChange} onChangeLimit={jest.fn()} />
        );

        await act(() => {
            fireEvent(getByText("budgets.editor.name"), "click");
        });
        // A blur, not a Done: tapping the next row is how a name was being lost.
        await act(() => {
            fireEvent(getByPlaceholderText("Groceries"), "endEditing", {
                nativeEvent: { text: "Weekly shop" },
            });
        });

        expect(onChange).toHaveBeenCalledWith({ name: "Weekly shop" });
    });

    it("writes nothing when the name field closes unchanged", async () => {
        const onChange = jest.fn();
        const { getByText, getByPlaceholderText } = await render(
            <BudgetEditor {...BASE} name="Weekly shop" onChange={onChange} onChangeLimit={jest.fn()} />
        );

        await act(() => {
            fireEvent(getByText("budgets.editor.name"), "click");
        });
        await act(() => {
            fireEvent(getByPlaceholderText("Groceries"), "endEditing", {
                nativeEvent: { text: "Weekly shop" },
            });
        });

        expect(onChange).not.toHaveBeenCalled();
    });

    it("states the window a cadence change would produce before anything else changes", async () => {
        const onChange = jest.fn();
        const { getByText } = await render(<BudgetEditor {...BASE} onChange={onChange} onChangeLimit={jest.fn()} />);

        await act(() => {
            fireEvent(getByText("budgets.editor.every"), "click");
        });
        await act(() => {
            fireEvent(getByText("budgets.periodName.week"), "click");
        });

        expect(onChange).toHaveBeenCalledWith({ type: BUDGET_TYPE.week });
        // The note stays on screen with the chips, because it describes what the
        // press just did.
        expect(getByText(/budgets\.editor\.reslice/)).toBeTruthy();
        // A cadence is a detent, and the chip is where it catches.
        expect(mockHaptic).toHaveBeenCalledWith("selection");
    });
});
