import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

const mockDatabase = mockUnusedDatabase();
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => mockDatabase }));
jest.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ accountId: "acct-1" }) }));
jest.mock("@/data/live-query", () => ({ useLiveValue: () => null }));
const mockPro = { locked: false, pending: false };
jest.mock("@/hooks/use-pro-locked", () => ({
    useProLocked: () => mockPro.locked,
    useProPending: () => mockPro.pending,
}));
jest.mock("@/lib/adoption-engine", () => ({
    adoptionEngine: () => ({ accountLedger: async () => "populated" }),
}));
let mockRelease: () => void = () => undefined;
const mockCompleteAdoption = jest.fn(
    () =>
        new Promise<void>((resolve) => {
            mockRelease = resolve;
        })
);
jest.mock("@/data/ledger-adoption", () => ({
    completeAdoption: () => mockCompleteAdoption(),
    localLedgerState: async () => "empty",
    prepareAccountAdoption: async () => undefined,
}));

import { LedgerAdoptionProvider, useLedgerAdoption } from "./ledger-adoption";

function Status() {
    return <Text>{useLedgerAdoption().status}</Text>;
}

describe("ledgerAdoptionProvider", () => {
    beforeEach(() => {
        mockCompleteAdoption.mockClear();
        mockPro.pending = false;
    });

    it("runs one adoption per account even when the entitlement flips mid-flight", async () => {
        const { getByText, rerender } = await render(
            <LedgerAdoptionProvider>
                <Status />
            </LedgerAdoptionProvider>
        );
        await act(async () => undefined);
        expect(mockCompleteAdoption).toHaveBeenCalledTimes(1);

        mockPro.pending = true;
        await rerender(
            <LedgerAdoptionProvider>
                <Status />
            </LedgerAdoptionProvider>
        );
        mockPro.pending = false;
        await rerender(
            <LedgerAdoptionProvider>
                <Status />
            </LedgerAdoptionProvider>
        );
        await act(async () => undefined);

        expect(mockCompleteAdoption).toHaveBeenCalledTimes(1);
        expect(getByText("resolving")).toBeTruthy();

        await act(async () => {
            mockRelease();
        });
        expect(getByText("settled")).toBeTruthy();
    });
});
