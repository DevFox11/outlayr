import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { createRef } from "react";
import type { ReactNode } from "react";

import { importDraftStore } from "@/lib/import-draft-store";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { ImportSheet, resolveLegalStep } from "./import-sheet";
import type { ImportSheetHandle } from "./import-sheet";

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockSnapToIndex = jest.fn();
const mockDismissHolder: { current?: () => void } = {};

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("uniwind", () => ({
    ...jest.requireActual<typeof import("uniwind")>("uniwind"),
    useCSSVariable: () => "#F2F0EA",
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            background: "#F2F0EA",
            foreground: "#17150F",
            muted: "#8A8578",
        }),
}));
jest.mock("expo-router", () => ({
    router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock<Partial<typeof import("react-native-safe-area-context")>>("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));
jest.mock("@expo/ui/community/bottom-sheet", () => {
    const { View: RNView } = require("react-native");
    const { useImperativeHandle } = require("react");
    return {
        BottomSheetModal: ({
            children,
            ref,
            onDismiss,
        }: {
            children: ReactNode;
            ref?: React.Ref<unknown>;
            onDismiss?: () => void;
        }) => {
            mockDismissHolder.current = onDismiss;
            useImperativeHandle(ref, () => ({
                dismiss: mockDismiss,
                present: jest.fn(),
                snapToIndex: mockSnapToIndex,
            }));
            return <RNView testID="bottom-sheet-modal">{children}</RNView>;
        },
    };
});
jest.mock("@/contexts/csv-import-context", () => ({
    CsvImportProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/hooks/use-import-review", () => ({
    useImportReview: () => ({
        categoryName: new Map(),
        categoryTile: new Map(),
        commit: { phase: "idle" },
        currency: "USD",
        excluded: new Set(),
        onCommit: jest.fn(),
        onToggle: jest.fn(),
        plan: { earliest: null, entries: [], latest: null, skipped: [] },
        rows: [],
        selectedCount: 0,
    }),
}));
jest.mock("./use-choose-import-file", () => ({
    useChooseImportFile: () => ({ choose: jest.fn(), status: "idle" }),
}));
jest.mock<Partial<typeof import("./steps/source-step")>>("./steps/source-step", () => {
    const { Text: RNText } = require("react-native");
    return { SourceStep: () => <RNText>step:source</RNText> };
});
jest.mock<Partial<typeof import("./steps/file-step")>>("./steps/file-step", () => {
    const { Text: RNText } = require("react-native");
    return { FileStep: () => <RNText>step:file</RNText> };
});
jest.mock<Partial<typeof import("./steps/resolve-step")>>("./steps/resolve-step", () => {
    const { Text: RNText } = require("react-native");
    return { ResolveStep: () => <RNText>step:resolve</RNText> };
});
jest.mock<Partial<typeof import("./steps/review-step")>>("./steps/review-step", () => {
    const { Text: RNText } = require("react-native");
    return { ReviewStep: () => <RNText>step:review</RNText> };
});
jest.mock<Partial<typeof import("./steps/done-step")>>("./steps/done-step", () => {
    const { Text: RNText } = require("react-native");
    return { DoneStep: () => <RNText>step:done</RNText> };
});

function loadFile() {
    importDraftStore.dispatch({ sourceId: "csv", type: "sourceSelected" });
    importDraftStore.dispatch({
        draft: {
            amount: 2,
            category: 0,
            currency: null,
            date: 0,
            exchangeRate: null,
            exchangeRateType: null,
            note: 1,
            type: null,
        },
        file: { chars: 42, name: "bank.csv" },
        gaps: [],
        parsed: { header: null, rows: [["a", "b", "c"]], width: 3 },
        resolved: {
            labelSource: "categoryColumn",
            mapping: {
                amount: 2,
                category: 0,
                currency: null,
                date: 0,
                exchangeRate: null,
                exchangeRateType: null,
                note: 1,
                type: null,
            },
        },
        type: "fileParsed",
    });
}

async function presentSheet() {
    const ref = createRef<ImportSheetHandle>();
    const screen = await render(<ImportSheet ref={ref} />);
    await act(async () => {
        ref.current?.present();
    });
    return { ref, ...screen };
}

describe("resolveLegalStep", () => {
    it("falls back to the earliest legal step when guards fail", () => {
        const empty = importDraftStore.getSnapshot().flow;
        expect(resolveLegalStep(empty, "review")).toBe("source");
        expect(resolveLegalStep(empty, "done")).toBe("source");
        expect(resolveLegalStep(empty, "source")).toBe("source");
    });

    it("lets a legal step through", () => {
        importDraftStore.clear();
        loadFile();
        const { flow } = importDraftStore.getSnapshot();
        expect(resolveLegalStep(flow, "file")).toBe("file");
        expect(resolveLegalStep(flow, "resolve")).toBe("resolve");
        expect(resolveLegalStep(flow, "review")).toBe("resolve");
        importDraftStore.clear();
    });
});

describe("importSheet", () => {
    beforeEach(() => {
        importDraftStore.clear();
        mockPush.mockClear();
        mockDismiss.mockClear();
        mockSnapToIndex.mockClear();
    });

    it("guards an illegal stored step back to the earliest legal one", async () => {
        importDraftStore.setStep("review");
        const { findByText } = await presentSheet();
        await expect(findByText("step:source")).resolves.toBeTruthy();
    });

    it("renders the file step with a back chevron that steps back through the store", async () => {
        loadFile();
        importDraftStore.setStep("file");
        const { findByText, getByTestId } = await presentSheet();
        await expect(findByText("step:file")).resolves.toBeTruthy();

        fireEvent.press(getByTestId("import-sheet-back"));
        expect(importDraftStore.getSnapshot().ui.step).toBe("source");
    });

    it("dismisses through the close button", async () => {
        const { getByTestId } = await presentSheet();
        fireEvent.press(getByTestId("import-sheet-close"));
        expect(mockDismiss).toHaveBeenCalledWith();
    });

    it("records a resume on dismissal mid-flow", async () => {
        loadFile();
        importDraftStore.setStep("file");
        await presentSheet();
        await act(async () => {
            mockDismissHolder.current?.();
        });
        expect(importDraftStore.getResumeStep()).toBe("file");
        expect(importDraftStore.getSnapshot().ui.resumed).toBe(true);
    });

    it("clears instead of recording a resume when dismissed after a success", async () => {
        loadFile();
        importDraftStore.dispatch({
            fromModel: new Set(),
            links: new Map(),
            outcome: "applied",
            reason: null,
            type: "resolutionSettled",
        });
        importDraftStore.dispatch({ type: "commitStarted" });
        importDraftStore.dispatch({
            count: 1,
            duplicatesSkipped: 0,
            outAmount: 3.5,
            type: "commitSucceeded",
        });
        importDraftStore.setStep("done");
        const { findByText } = await presentSheet();
        await expect(findByText("step:done")).resolves.toBeTruthy();

        await act(async () => {
            mockDismissHolder.current?.();
        });
        expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
        expect(importDraftStore.getResumeStep()).toBe("source");
    });

    it("shows the resume notice on a resumed reopen and Start over clears", async () => {
        loadFile();
        importDraftStore.setStep("file");
        importDraftStore.commitDismissal();
        const { findByTestId, getByTestId } = await presentSheet();
        await expect(findByTestId("import-resume-notice")).resolves.toBeTruthy();

        fireEvent.press(getByTestId("import-resume-start-over"));
        expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
    });
});
