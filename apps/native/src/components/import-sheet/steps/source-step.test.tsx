import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { SourceStep } from "./source-step";

const mockDispatch = jest.fn();
const mockSetStep = jest.fn();

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            foreground: "#17150F",
            muted: "#8A8578",
        }),
}));
jest.mock("@/lib/import-draft-store", () => ({
    importDraftStore: {
        dispatch: (...args: unknown[]) => mockDispatch(...args),
        setStep: (...args: unknown[]) => mockSetStep(...args),
    },
}));
jest.mock<Partial<typeof import("@/domain/import-sources")>>("@/domain/import-sources", () => ({
    IMPORT_SOURCES: [
        {
            available: true,
            icon: [],
            id: "csv",
            subtitleKey: "settings.import.sourceCsvSubtitle",
            titleKey: "settings.import.sourceCsvTitle",
        },
        {
            available: false,
            icon: [],
            id: "clipboard",
            subtitleKey: "settings.import.sourceClipboardSubtitle",
            titleKey: "settings.import.sourceClipboardTitle",
        },
    ],
}));

describe("sourceStep", () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockSetStep.mockClear();
    });

    it("selects the source and advances to the file step on tap", async () => {
        const { getByTestId } = await render(<SourceStep />);

        fireEvent.press(getByTestId("import-source-csv"));

        expect(mockDispatch).toHaveBeenCalledWith({
            sourceId: "csv",
            type: "sourceSelected",
        });
        expect(mockSetStep).toHaveBeenCalledWith("file");
    });

    it("renders an unavailable source dimmed with a coming-soon subtitle and no advance", async () => {
        const { getByTestId, getByText } = await render(<SourceStep />);

        expect(getByText("import.sourceComingSoon")).toBeTruthy();
        fireEvent.press(getByTestId("import-source-clipboard"));
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockSetStep).not.toHaveBeenCalled();
    });
});
