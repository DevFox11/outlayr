import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AccessibilityInfo, Text as MockText } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { EditTransfer } from "./edit";

const mockSheet = jest.fn<(options: { sheetAllowedDetents: number[]; sheetGrabberVisible: boolean }) => void>();

jest.mock("expo-router", () => ({
    Stack: {
        Screen: Object.assign(
            ({ options }: { options: Parameters<typeof mockSheet>[0] }) => {
                mockSheet(options);
                return null;
            },
            { Title: ({ children }: { children: ReactNode }) => <MockText>{children}</MockText> }
        ),
    },
    useNavigation: () => ({ addListener: () => () => {} }),
    useRouter: () => ({ back: jest.fn() }),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock("@/data/transfers-core", () => ({
    savedTransfer: (_db: unknown, id: string) => ({ id }),
}));

jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ pendingId: null, requestDelete: jest.fn() }),
}));

jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));

jest.mock("@/components/close-toolbar", () => ({ CloseToolbar: () => null }));

jest.mock("@/hooks/use-discard-guard", () => ({
    useDiscardGuard: () => ({ leave: jest.fn(), setDirty: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 62 }),
}));

jest.mock("@/components/transfer-editor", () => ({
    __esModule: true,
    default: ({
        rest,
        saved,
    }: {
        rest?: { onHeight: (height: number) => void; onWake: () => void };
        saved: { id: string };
    }) => (
        <>
            <MockText onPress={rest?.onWake}>{`editor:${saved.id}`}</MockText>
            <MockText onPress={() => rest?.onHeight(400)}>taller</MockText>
        </>
    ),
}));

beforeEach(() => {
    mockSheet.mockClear();
});

describe("editTransfer", () => {
    it("opens as a short untitled sheet and grows into the titled, announced editor once a word is tapped", async () => {
        const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
        await render(<EditTransfer id="transfer" />);

        const [resting] = mockSheet.mock.lastCall ?? [];
        expect(resting?.sheetAllowedDetents[0]).toBeLessThan(0.5);
        expect(resting?.sheetGrabberVisible).toBe(true);
        expect(screen.queryByText("transfers.title")).toBeNull();

        await fireEvent.press(screen.getByText("editor:transfer"));

        expect(mockSheet).toHaveBeenLastCalledWith({ sheetAllowedDetents: [1], sheetGrabberVisible: false });
        expect(screen.getByText("transfers.title")).toBeTruthy();
        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith("transfers.title");
    });

    it("sizes the resting sheet to the height its editor reports", async () => {
        await render(<EditTransfer id="transfer" />);
        const before = mockSheet.mock.lastCall?.[0].sheetAllowedDetents[0] ?? 0;

        await fireEvent.press(screen.getByText("taller"));

        expect(mockSheet.mock.lastCall?.[0].sheetAllowedDetents[0]).toBeGreaterThan(before);
    });
});
