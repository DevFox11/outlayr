import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text as MockText } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { EditTransaction } from "./edit";

const mockRows = new Map<
    string,
    { deletedAt: Date | null; feeForId: string | null; id: string; transferId: string | null }
>();
const mockLiveTransfers = new Set<string>();
const mockSheet = jest.fn<(options: { sheetAllowedDetents: number[]; sheetGrabberVisible: boolean }) => void>();
const mockDetentListener = { current: (_event: { data: { index: number } }) => {} };

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
        useRouter: () => ({ back: jest.fn() }),
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
    useDiscardGuard: () => ({ leave: jest.fn(), setDirty: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 62 }),
}));

jest.mock("@/components/transaction-form", () => ({
    TransactionForm: ({ initial, rest }: { initial: { id: string }; rest?: { onWake: () => void } }) => (
        <MockText onPress={rest?.onWake}>{`form:${initial.id}`}</MockText>
    ),
}));

jest.mock("@/screens/transfers/edit", () => ({
    EditTransfer: ({ id }: { id: string }) => <MockText>{`transfer:${id}`}</MockText>,
}));

beforeEach(() => {
    mockSheet.mockClear();
    mockRows.clear();
    mockLiveTransfers.clear();
    mockRows.set("fee", { deletedAt: null, feeForId: null, id: "fee", transferId: "transfer" });
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
