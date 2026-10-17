import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { DoneStep } from "./done-step";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            foreground: "#17150F",
            income: "#2E7D32",
            muted: "#8A8578",
        }),
}));
jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ showCents: true }),
}));

const ENTRY = {
    amount: 12.5,
    categoryId: "cat-food",
    currency: null,
    date: new Date(2026, 6, 28),
    income: false,
    note: "Bakery",
};

function doneReview(overrides: Partial<ImportReviewResult> = {}): ImportReviewResult {
    return {
        categoryName: new Map(),
        categoryTile: new Map(),
        commit: {
            count: 12,
            duplicatesSkipped: 0,
            outAmount: 348.4,
            phase: "success",
        },
        currency: "USD",
        excluded: new Set([1]),
        onCommit: jest.fn(),
        onToggle: jest.fn(),
        plan: {
            earliest: new Date(2026, 6, 1),
            entries: [ENTRY],
            latest: new Date(2026, 6, 28),
            skipped: [],
        },
        rows: [
            {
                duplicate: false,
                entry: ENTRY,
                index: 0,
                key: "entry-0",
                kind: "entry",
            },
            {
                duplicate: true,
                entry: ENTRY,
                index: 1,
                key: "entry-1",
                kind: "entry",
            },
        ],
        selectedCount: 1,
        ...overrides,
    } as ImportReviewResult;
}

describe("doneStep", () => {
    it("renders the ink stamp with the committed count", async () => {
        const { getByTestId, getByText } = await render(<DoneStep onDone={jest.fn()} review={doneReview()} />);
        expect(getByTestId("import-done-stamp")).toBeTruthy();
        expect(getByText('import.doneStamp:{"count":12}')).toBeTruthy();
    });

    it("names the skipped duplicates and the month now on the Log", async () => {
        const { getByText } = await render(
            <DoneStep
                onDone={jest.fn()}
                review={doneReview({
                    commit: {
                        count: 12,
                        duplicatesSkipped: 1,
                        outAmount: 348.4,
                        phase: "success",
                    },
                })}
            />
        );
        // The literal, not `toLocaleDateString` again: deriving the expectation the
        // same way the component does passes whatever locale the runner is in,
        // which is exactly the bug this covers.
        expect(getByText('import.doneSubline:{"count":1,"month":"July"}')).toBeTruthy();
    });

    it("drops the duplicates clause when none were skipped", async () => {
        const review = doneReview({ excluded: new Set<number>() });
        review.rows = [review.rows[0]];
        const { getByText } = await render(<DoneStep onDone={jest.fn()} review={review} />);
        expect(getByText('import.doneSublineNoDuplicates:{"month":"July"}')).toBeTruthy();
    });

    it("shows the added count and out amount in the measure strip", async () => {
        const { getByText } = await render(<DoneStep onDone={jest.fn()} review={doneReview()} />);
        expect(getByText("import.doneAddedLabel")).toBeTruthy();
        expect(getByText("12")).toBeTruthy();
        expect(getByText("log.measure.out")).toBeTruthy();
        expect(getByText("-$348.40")).toBeTruthy();
    });

    it("dismisses through the ghost Done button", async () => {
        const onDone = jest.fn();
        const { getByTestId } = await render(<DoneStep onDone={onDone} review={doneReview()} />);
        fireEvent.press(getByTestId("import-done-cta"));
        expect(onDone).toHaveBeenCalledTimes(1);
    });
});
