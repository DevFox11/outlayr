import { describe, expect, it, jest } from "@jest/globals";
import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import { act, fireEvent, render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { BudgetLimitBody } from "./budget-limit-body";
import type { LimitCommit, LimitTarget } from "./budget-limit-body";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en", setLanguage: jest.fn() }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578", tint: "#C2371B" }),
}));
jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: false }),
    useSettingNumber: () => 0,
}));
// The plot is Skia and the keypad is glass; neither survives jest, and neither is
// what these tests are about.
jest.mock("./budget-limit-picker", () => ({ BudgetLimitPicker: () => null }));
jest.mock("@/components/amount-numpad", () => {
    const { Pressable, Text: RNText } = require("react-native");
    return {
        AmountNumpad: ({ onChange }: { onChange: (next: string) => void }) => (
            <Pressable onPress={() => onChange("500")} testID="type-500">
                <RNText>keys</RNText>
            </Pressable>
        ),
    };
});

const CALENDAR = { firstDayOfMonth: 1, firstWeekday: 1 } as const;
const NOW = new Date(2026, 7, 20).getTime();

const GROCERIES: LimitTarget = {
    categoryId: "groceries",
    limit: 400,
    name: "Groceries",
    type: BUDGET_TYPE.month,
    window: { end: new Date(2026, 8, 1), start: new Date(2026, 7, 1) },
};

function mount(onCommit: (commit: LimitCommit) => Promise<void> | void, target: LimitTarget = GROCERIES) {
    return render(
        <BudgetLimitBody
            calendar={CALENDAR}
            contributions={[]}
            currency="USD"
            nowMs={NOW}
            onCommit={onCommit}
            target={target}
        />
    );
}

describe("the limit body", () => {
    it("reports an untouched figure as unchanged, so the stored limit stands", async () => {
        // What is on screen is the stored limit converted into the ledger's
        // currency. Writing it back would restate a EUR budget in USD.
        const onCommit = jest.fn<(commit: LimitCommit) => void>();
        const { getByText } = await mount(onCommit);

        await act(() => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).toHaveBeenCalledWith({ limit: 400, limitChanged: false, type: BUDGET_TYPE.month });
    });

    it("reports a typed figure as changed", async () => {
        const onCommit = jest.fn<(commit: LimitCommit) => void>();
        const { getByLabelText, getByTestId, getByText } = await mount(onCommit);

        await act(() => {
            fireEvent(getByLabelText("budgets.sheet.editLimitA11y"), "click");
        });
        await act(() => {
            fireEvent(getByTestId("type-500"), "click");
        });
        await act(() => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).toHaveBeenCalledWith({ limit: 500, limitChanged: true, type: BUDGET_TYPE.month });
    });

    it("commits once however many times the button is pressed", async () => {
        // `createMainBudget` reads before it inserts and the table has no singleton
        // constraint, so two presses landing together would each see no overall
        // budget and insert one. The sheet is still on screen while it dismisses.
        const onCommit = jest.fn<(commit: LimitCommit) => void>();
        const { getByText } = await mount(onCommit);

        await act(() => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("takes the next press once the write it was holding for has settled", async () => {
        // The first-run takeover renders this body inline and stays mounted through
        // a failed write; a latch rather than a hold would swallow every retry.
        const onCommit = jest.fn<(commit: LimitCommit) => Promise<void>>(() => Promise.resolve());
        const { getByText } = await mount(onCommit);

        await act(async () => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });
        await act(async () => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).toHaveBeenCalledTimes(2);
    });

    it("opens on four fifths of this window when the scope has no closed history", async () => {
        // A first-run ledger has spending but no closed window to draw a typical
        // figure from, and opening on zero makes the primary action a dead end.
        const onCommit = jest.fn<(commit: LimitCommit) => void>();
        const spentToday = [
            { amount: 300, categoryId: "groceries", date: new Date(2026, 7, 4), parentId: null },
            { amount: 200, categoryId: "groceries", date: new Date(2026, 7, 11), parentId: null },
        ];
        const { getByText } = await render(
            <BudgetLimitBody
                calendar={CALENDAR}
                contributions={spentToday}
                currency="USD"
                nowMs={NOW}
                onCommit={onCommit}
                target={{ ...GROCERIES, limit: null }}
            />
        );

        await act(() => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ limit: 400 }));
    });

    it("opens the keypad rather than committing a limit of nothing", async () => {
        // A scope with no budget and no history opens on zero. The button stays
        // live, because a press that cannot commit still has to do something.
        const onCommit = jest.fn<(commit: LimitCommit) => void>();
        const { getByTestId, getByText, queryByTestId } = await mount(onCommit, {
            ...GROCERIES,
            limit: null,
            window: null,
        });

        expect(queryByTestId("type-500")).toBeNull();
        await act(() => {
            fireEvent(getByText(/budgets\.picker\.commit/), "click");
        });

        expect(onCommit).not.toHaveBeenCalled();
        expect(getByTestId("type-500")).toBeTruthy();
    });
});
