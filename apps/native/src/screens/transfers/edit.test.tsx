import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AccessibilityInfo, Text as MockText } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { EditTransfer } from "./edit";

const mockSheet = jest.fn<(options: { sheetAllowedDetents: number[]; sheetGrabberVisible: boolean }) => void>();
const mockPush = jest.fn<(href: string) => void>();
const mockNotRestored = jest.fn();
/** What the screen hands the discard guard to recover a swiped-away sheet. */
const mockGuard: { recovery?: { restore: (draft: unknown) => void; snapshot: () => unknown } } = {};
/** The edits the mocked editor publishes, and every `restore` it was rendered with. */
const mockDraft = { draft: { sentText: "5" }, note: "" };
const mockEditorRestores: unknown[] = [];
const mockTransfers = new Map<string, { id: string; note: string }>();

jest.mock("expo-router", () => ({
    Stack: {
        Header: () => null,
        Screen: Object.assign(
            ({ options }: { options: Parameters<typeof mockSheet>[0] }) => {
                mockSheet(options);
                return null;
            },
            { Title: ({ children }: { children: ReactNode }) => <MockText>{children}</MockText> }
        ),
    },
    useNavigation: () => ({ addListener: () => () => {} }),
    useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock("@/data/transfers-core", () => ({
    sameSavedTransfer: (a: { note: string }, b: { note: string }) => a.note === b.note,
    savedTransfer: (_db: unknown, id: string) => mockTransfers.get(id) ?? null,
}));

jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ pendingId: null, requestDelete: jest.fn() }),
}));

jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));

jest.mock("@/components/close-toolbar", () => ({ CloseToolbar: () => null }));

jest.mock("@/hooks/use-discard-guard", () => ({
    useDiscardGuard: (recovery: typeof mockGuard.recovery) => {
        mockGuard.recovery = recovery;
        return { leave: jest.fn(), setDirty: jest.fn() };
    },
}));

jest.mock("@/components/edits-discarded-snackbar", () => ({
    notifyEditsNotRestored: () => mockNotRestored(),
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 62 }),
}));

jest.mock("@/components/transfer-editor", () => ({
    __esModule: true,
    default: ({
        draftRef,
        rest,
        restore,
        saved,
    }: {
        draftRef?: { current: (() => unknown) | null };
        rest?: { onHeight: (height: number) => void; onWake: () => void };
        restore?: unknown;
        saved: { id: string };
    }) => {
        if (draftRef) {
            draftRef.current = () => mockDraft;
        }
        mockEditorRestores.push(restore);
        return (
            <>
                <MockText onPress={rest?.onWake}>{`editor:${saved.id}`}</MockText>
                <MockText onPress={() => rest?.onHeight(400)}>taller</MockText>
            </>
        );
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockEditorRestores.length = 0;
    mockTransfers.set("transfer", { id: "transfer", note: "" });
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

describe("editTransfer after a swipe discarded its edits", () => {
    it("reopens the transfer with them on Undo", async () => {
        const swiped = await render(<EditTransfer id="transfer" />);
        const draft = mockGuard.recovery?.snapshot();
        await swiped.unmount();

        mockGuard.recovery?.restore(draft);
        expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/transfer");
        await render(<EditTransfer id="transfer" />);

        expect(mockEditorRestores.at(-1)).toStrictEqual(mockDraft);
    });

    it("keeps them discarded when the transfer changed meanwhile", async () => {
        await render(<EditTransfer id="transfer" />);
        const draft = mockGuard.recovery?.snapshot();
        mockTransfers.set("transfer", { id: "transfer", note: "edited elsewhere" });

        mockGuard.recovery?.restore(draft);

        expect(mockNotRestored).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });
});
