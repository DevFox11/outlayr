import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Text as MockText } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { EditTransaction } from "./edit";

const mockRows = new Map<
    string,
    { deletedAt: Date | null; feeForId: string | null; id: string; transferId: string | null }
>();
const mockLiveTransfers = new Set<string>();

jest.mock("expo-router", () => {
    const Noop = () => null;
    return {
        Stack: Object.assign(Noop, {
            Header: Noop,
            Screen: Object.assign(Noop, { Title: Noop }),
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

jest.mock("@/components/transaction-form", () => ({
    TransactionForm: ({ initial }: { initial: { id: string } }) => <MockText>{`form:${initial.id}`}</MockText>,
}));

jest.mock("@/screens/transfers/edit", () => ({
    EditTransfer: ({ id }: { id: string }) => <MockText>{`transfer:${id}`}</MockText>,
}));

beforeEach(() => {
    mockRows.clear();
    mockLiveTransfers.clear();
    mockRows.set("fee", { deletedAt: null, feeForId: null, id: "fee", transferId: "transfer" });
});

describe("editTransaction", () => {
    it("opens a transfer's fee in the transfer editor", async () => {
        mockLiveTransfers.add("transfer");

        await render(<EditTransaction id="fee" />);

        expect(screen.getByText("transfer:transfer")).toBeTruthy();
    });

    it("keeps a fee whose transfer is gone editable as a transaction", async () => {
        await render(<EditTransaction id="fee" />);

        expect(screen.getByText("form:fee")).toBeTruthy();
    });
});
