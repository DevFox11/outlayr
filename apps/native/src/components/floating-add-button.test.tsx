import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode, Ref } from "react";

import { FloatingAddButton } from "./floating-add-button";

const mockPush = jest.fn();
const mockGetResumeStep = jest.fn(() => "source");
const mockSetStep = jest.fn();
const mockPresent = jest.fn();
const mockAccounts = jest.fn(() => [{ id: "a" }, { id: "b" }]);

jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("expo-router", () => ({
    router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("@/contexts/local-data-context", () => ({
    useDatabase: () => ({}),
}));
jest.mock("@/data/accounts", () => ({
    useAccounts: () => mockAccounts(),
}));
jest.mock("@/lib/import-draft-store", () => ({
    importDraftStore: {
        getResumeStep: () => mockGetResumeStep(),
        setStep: (...args: unknown[]) => mockSetStep(...args),
    },
}));
jest.mock("@/components/import-sheet/import-sheet", () => {
    const { useImperativeHandle } = require("react");
    return {
        ImportSheet: ({ ref }: { ref?: Ref<unknown> }) => {
            useImperativeHandle(ref, () => ({
                dismiss: jest.fn(),
                present: mockPresent,
            }));
            return null;
        },
    };
});
jest.mock("@expo/ui", () => {
    const { Pressable, Text } = require("react-native");
    return {
        Button: ({ label, onPress }: { label: string; onPress?: () => void }) => (
            <Pressable accessibilityRole="button" onPress={onPress}>
                <Text>{label}</Text>
            </Pressable>
        ),
        Host: ({ children }: { children: ReactNode }) => children,
    };
});
jest.mock("@expo/ui/swift-ui", () => ({
    Menu: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- the key is the real module's export name, so a rename would stop the mock standing in for it
    buttonBorderShape: () => ({}),
    buttonStyle: () => ({}),
    controlSize: () => ({}),
    labelStyle: () => ({}),
    tint: () => ({}),
}));

describe("floatingAddButton", () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockGetResumeStep.mockClear();
        mockSetStep.mockClear();
        mockPresent.mockClear();
        mockGetResumeStep.mockReturnValue("source");
        mockAccounts.mockReturnValue([{ id: "a" }, { id: "b" }]);
    });

    it("renders through uniwind + expo-router + @expo/ui together", async () => {
        const { toJSON } = await render(<FloatingAddButton />);
        expect(toJSON()).toBeTruthy();
    });

    it("pushes /transactions/create when the transaction row is pressed", async () => {
        const { getByText } = await render(<FloatingAddButton />);
        fireEvent.press(getByText("log.add.transaction"));
        expect(mockPush).toHaveBeenCalledWith("/transactions/create");
    });

    it("seeds the resume step and presents the sheet when the import row is pressed", async () => {
        mockGetResumeStep.mockReturnValue("resolve");
        const { getByText } = await render(<FloatingAddButton />);

        fireEvent.press(getByText("log.add.import"));

        expect(mockSetStep).toHaveBeenCalledWith("resolve");
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("presents at the source step when nothing is in progress", async () => {
        const { getByText } = await render(<FloatingAddButton />);

        fireEvent.press(getByText("log.add.import"));

        expect(mockSetStep).toHaveBeenCalledWith("source");
        expect(mockPresent).toHaveBeenCalledTimes(1);
    });

    it("offers a transfer once there are two accounts to move between", async () => {
        const { getByText } = await render(<FloatingAddButton />);

        fireEvent.press(getByText("log.add.transfer"));

        expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/create");
    });

    it("hides the transfer row with only one account, since both legs are required", async () => {
        mockAccounts.mockReturnValue([{ id: "a" }]);
        const { queryByText } = await render(<FloatingAddButton />);

        expect(queryByText("log.add.transfer")).toBeNull();
    });

    it("hides it with no accounts at all", async () => {
        mockAccounts.mockReturnValue([]);
        const { queryByText } = await render(<FloatingAddButton />);

        expect(queryByText("log.add.transfer")).toBeNull();
    });
});
