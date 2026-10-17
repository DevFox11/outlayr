import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import type { ResolvedMapping } from "@/domain/import-mapping";
import { importDraftStore } from "@/lib/import-draft-store";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { FileStep } from "./file-step";

const mockChoose = jest.fn();

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            background: "#F2F0EA",
            danger: "#B5482F",
            foreground: "#17150F",
            income: "#2E7D32",
            muted: "#8A8578",
            subtle: "#B4AFA0",
        }),
}));

const RESOLVED_MAPPING: ResolvedMapping = {
    labelSource: "descriptionColumn",
    mapping: {
        amount: 2,
        category: 1,
        currency: null,
        date: 0,
        exchangeRate: null,
        exchangeRateType: null,
        note: 1,
        type: null,
    },
};

function loadFile(gaps: readonly string[], resolved: ResolvedMapping | null) {
    importDraftStore.dispatch({ sourceId: "csv", type: "sourceSelected" });
    importDraftStore.dispatch({
        draft: {
            amount: 2,
            category: 1,
            currency: null,
            date: 0,
            exchangeRate: null,
            exchangeRateType: null,
            note: 1,
            type: null,
        },
        file: { chars: 42, name: "bank.csv" },
        gaps: gaps as never,
        parsed: {
            header: ["date", "description", "amount"],
            rows: [["13/08/2026", "Coffee", "3,50"]],
            width: 3,
        },
        resolved,
        type: "fileParsed",
    });
}

describe("fileStep", () => {
    beforeEach(() => {
        mockChoose.mockClear();
        importDraftStore.clear();
    });

    it("renders the empty state with its own Choose CSV pill", async () => {
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);
        expect(getByText("import.fileEmptyCaption")).toBeTruthy();
        expect(getByText("import.fileOnDeviceNote")).toBeTruthy();

        fireEvent.press(getByText("import.chooseCsv"));
        expect(mockChoose).toHaveBeenCalledTimes(1);
    });

    it("shows the error block with the Choose CSV pill as the retry", async () => {
        importDraftStore.setFileError({ cause: "empty" });
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);
        expect(getByText("import.errorEmptyTitle")).toBeTruthy();
        expect(getByText("import.errorEmptyBody")).toBeTruthy();

        fireEvent.press(getByText("import.chooseCsv"));
        expect(mockChoose).toHaveBeenCalledTimes(1);
    });

    it("shows the io error body from the thrown key", async () => {
        importDraftStore.setFileError({
            cause: "io",
            key: "alerts.transfer.unreadableFile",
        });
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);
        expect(getByText("import.errorIoTitle")).toBeTruthy();
        expect(getByText("alerts.transfer.unreadableFile")).toBeTruthy();
    });

    it("names each mapping gap and re-invokes the picker from Choose a different file", async () => {
        loadFile(["noLabelColumn"], null);
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);

        expect(getByText("import.mappingGapTitle")).toBeTruthy();
        expect(getByText("import.mappingGapNoLabel")).toBeTruthy();
        expect(getByText("import.mappingGapGuidance")).toBeTruthy();

        fireEvent.press(getByText("import.chooseDifferentFile"));
        expect(mockChoose).toHaveBeenCalledTimes(1);
    });

    it("shows the loaded file row with the on-device caption and the measure strip", async () => {
        loadFile([], RESOLVED_MAPPING);
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);

        expect(getByText("bank.csv")).toBeTruthy();
        expect(getByText("import.fileReadOnDevice")).toBeTruthy();
        expect(getByText("import.fileRowsLabel")).toBeTruthy();
        expect(getByText("import.fileColumnsLabel")).toBeTruthy();
        expect(getByText("import.fileDatesLabel")).toBeTruthy();
        expect(getByText("dd/MM/yyyy")).toBeTruthy();

        fireEvent.press(getByText("import.chooseDifferentFile"));
        expect(mockChoose).toHaveBeenCalledTimes(1);
    });

    it("advances to resolve from the loaded state's Continue", async () => {
        loadFile([], RESOLVED_MAPPING);
        const { getByTestId } = await render(<FileStep onChoose={mockChoose} />);

        fireEvent.press(getByTestId("import-file-continue"));
        expect(importDraftStore.getSnapshot().ui.step).toBe("resolve");
    });

    it("shows the description-column note only when that column supplied the label", async () => {
        loadFile([], RESOLVED_MAPPING);
        const { getByText } = await render(<FileStep onChoose={mockChoose} />);
        expect(getByText("import.fileNoCategoryColumn")).toBeTruthy();
    });

    it("hides the description-column note when the category column supplied the label", async () => {
        loadFile([], { ...RESOLVED_MAPPING, labelSource: "categoryColumn" });
        const { queryByText } = await render(<FileStep onChoose={mockChoose} />);
        expect(queryByText("import.fileNoCategoryColumn")).toBeNull();
    });
});
