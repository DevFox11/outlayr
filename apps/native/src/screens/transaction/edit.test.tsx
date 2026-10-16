import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text as MockText } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { EditTransaction } from "./edit";

interface MockRow {
    deletedAt: Date | null;
    feeForId: string | null;
    id: string;
    transferId: string | null;
    updatedAt: Date;
}

const FEE_ROW: MockRow = { deletedAt: null, feeForId: null, id: "fee", transferId: "transfer", updatedAt: new Date(1) };
const mockRows = new Map<string, MockRow>();
const mockLiveTransfers = new Set<string>();
const mockSheet = jest.fn<(options: { sheetAllowedDetents: number[]; sheetGrabberVisible: boolean }) => void>();
const mockDetentListener = { current: (_event: { data: { index: number } }) => {} };
const mockPush = jest.fn<(href: string) => void>();
const mockNotRestored = jest.fn();
/** What the screen hands the discard guard to recover a swiped-away sheet. */
const mockGuard: { recovery?: { restore: (draft: unknown) => void; snapshot: () => unknown } } = {};
/** The edits the mocked form publishes, and every `restore` it was rendered with. */
const mockDraft = { values: { amount: "8459" } };
const mockFormRestores: unknown[] = [];

jest.mock("expo-router", () => {
    const Noop = () => null;
    return {
        Stack: Object.assign(Noop, {
            Header: Noop,
            Screen: Object.assign(
                ({ options }: { options: Parameters<typeof mockSheet>[0] }) => {
                    mockSheet(options);
                    return null;
                },
                { Title: Noop }
            ),
        }),
        useNavigation: () => ({
            addListener: (_name: string, listener: typeof mockDetentListener.current) => {
                mockDetentListener.current = listener;
                return () => {};
            },
        }),
        useRouter: () => ({ back: jest.fn(), push: mockPush }),
    };
});

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock("@/data/transactions-core", () => ({
    getTransactionById: (_db: unknown, id: string) => mockRows.get(id) ?? null,
}));

jest.mock("@/data/transfers-core", () => ({
    savedTransfer: (_db: unknown, id: string) => (mockLiveTransfers.has(id) ? { id } : null),
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

jest.mock("@/components/transaction-form", () => ({
    TransactionForm: ({
        draftRef,
        initial,
        rest,
        restore,
    }: {
        draftRef?: { current: (() => unknown) | null };
        initial: { id: string };
        rest?: { onWake: () => void };
        restore?: unknown;
    }) => {
        if (draftRef) {
            draftRef.current = () => mockDraft;
        }
        mockFormRestores.push(restore);
        return <MockText onPress={rest?.onWake}>{`form:${initial.id}`}</MockText>;
    },
}));

jest.mock("@/screens/transfers/edit", () => ({
    EditTransfer: ({ id }: { id: string }) => <MockText>{`transfer:${id}`}</MockText>,
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRows.clear();
    mockLiveTransfers.clear();
    mockFormRestores.length = 0;
    mockRows.set("fee", FEE_ROW);
});

describe("editTransaction", () => {
    it("opens a transfer's fee in the transfer editor and leaves the sheet's height to it", async () => {
        mockLiveTransfers.add("transfer");

        await render(<EditTransaction id="fee" />);

        expect(screen.getByText("transfer:transfer")).toBeTruthy();
        expect(mockSheet).not.toHaveBeenCalled();
    });

    it("opens a transaction as a short sheet and grows it to full height once the form wakes", async () => {
        await render(<EditTransaction id="fee" />);

        const [resting] = mockSheet.mock.lastCall ?? [];
        expect(resting?.sheetAllowedDetents[0]).toBeLessThan(0.5);
        expect(resting?.sheetGrabberVisible).toBe(true);

        await fireEvent.press(screen.getByText("form:fee"));

        expect(mockSheet).toHaveBeenLastCalledWith({ sheetAllowedDetents: [1], sheetGrabberVisible: false });
    });

    it("wakes, and says so once, when the short sheet is dragged up to full height", async () => {
        const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockClear();
        await render(<EditTransaction id="fee" />);
        expect(mockSheet.mock.lastCall?.[0].sheetAllowedDetents).toHaveLength(2);

        await act(async () => {
            mockDetentListener.current({ data: { index: 1 } });
        });

        expect(mockSheet).toHaveBeenLastCalledWith({ sheetAllowedDetents: [1], sheetGrabberVisible: false });
        expect(announce).toHaveBeenCalledTimes(1);
    });

    it("keeps a fee whose transfer is gone editable as a transaction", async () => {
        await render(<EditTransaction id="fee" />);

        expect(screen.getByText("form:fee")).toBeTruthy();
    });
});

describe("editTransaction after a swipe discarded its edits", () => {
    it("reopens the entry with them on Undo, and only that once", async () => {
        const swiped = await render(<EditTransaction id="fee" />);
        const draft = mockGuard.recovery?.snapshot();
        await swiped.unmount();

        mockGuard.recovery?.restore(draft);
        expect(mockPush).toHaveBeenCalledWith("/transactions/fee");
        const reopened = await render(<EditTransaction id="fee" />);
        expect(mockFormRestores.at(-1)).toStrictEqual(mockDraft);
        await reopened.unmount();

        await render(<EditTransaction id="fee" />);
        expect(mockFormRestores.at(-1)).toBeUndefined();
    });

    it.each([
        ["changed", { updatedAt: new Date(2) }],
        ["deleted", { deletedAt: new Date(2), updatedAt: new Date(2) }],
    ])("keeps them discarded when the entry was %s meanwhile", async (_case, change) => {
        await render(<EditTransaction id="fee" />);
        const draft = mockGuard.recovery?.snapshot();
        mockRows.set("fee", { ...FEE_ROW, ...change });

        mockGuard.recovery?.restore(draft);

        expect(mockNotRestored).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });
});
