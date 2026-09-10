import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import { FREE_ACCOUNTS } from "@/domain/pro-limits";

import { useAccountCreateRoute, useCurrencyBlocked } from "./use-pro-gate";

const mockAccounts = jest.fn<() => { currency: string; id: string }[]>();
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => null }));
jest.mock("@/data/accounts", () => ({ useAccounts: () => mockAccounts() }));
// The caps only lock where Pro can be sold, which needs an account service.
const cloud: { runtime: object | null } = { runtime: {} };
jest.mock("@/lib/convex", () => ({
    get convex() {
        return cloud.runtime;
    },
}));

const mockRevenueCat = { isConfigured: true, isMirrored: false, isPro: false, isResolved: true };
jest.mock("@/contexts/revenuecat-context", () => ({ useRevenueCat: () => mockRevenueCat }));

function accounts(count: number): { currency: string; id: string }[] {
    return Array.from({ length: count }, (_, index) => ({ currency: "USD", id: `account-${index}` }));
}

describe("useAccountCreateRoute", () => {
    beforeEach(() => {
        mockRevenueCat.isConfigured = true;
        mockRevenueCat.isPro = false;
        mockRevenueCat.isResolved = true;
        cloud.runtime = {};
    });

    it("sends a free owner who is already at the cap to the paywall", async () => {
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));

        const { result } = await renderHook(() => useAccountCreateRoute());

        expect(result.current).toBe("/paywall");
    });

    it("opens the editor while a free owner is still under the cap", async () => {
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS - 1));

        const { result } = await renderHook(() => useAccountCreateRoute());

        expect(result.current).toBe("/accounts/create");
    });

    it("does not cap a build that has no way to sell the unlock", async () => {
        cloud.runtime = null;
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));

        const { result } = await renderHook(() => useAccountCreateRoute());

        expect(result.current).toBe("/accounts/create");
    });

    it("does not send a customer to the paywall before the store has answered", async () => {
        mockRevenueCat.isResolved = false;
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));

        const { result } = await renderHook(() => useAccountCreateRoute());

        expect(result.current).toBe("/accounts/create");
    });

    it("never charges a Pro owner for the next account", async () => {
        mockRevenueCat.isPro = true;
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS + 4));

        const { result } = await renderHook(() => useAccountCreateRoute());

        expect(result.current).toBe("/accounts/create");
    });
});

describe("useCurrencyBlocked", () => {
    beforeEach(() => {
        mockRevenueCat.isConfigured = true;
        mockRevenueCat.isPro = false;
        mockRevenueCat.isResolved = true;
        cloud.runtime = {};
    });

    it("lets a free owner switch their only account to another currency", async () => {
        mockAccounts.mockReturnValue([{ currency: "USD", id: "account-0" }]);

        const { result } = await renderHook(() => useCurrencyBlocked("account-0"));

        expect(result.current("VES")).toBe(false);
    });

    it("still blocks a second currency when another account keeps the first", async () => {
        mockAccounts.mockReturnValue([
            { currency: "USD", id: "account-0" },
            { currency: "USD", id: "account-1" },
        ]);

        const { result } = await renderHook(() => useCurrencyBlocked("account-0"));

        expect(result.current("VES")).toBe(true);
    });

    it("lets an over-cap account keep the currency it already has", async () => {
        mockAccounts.mockReturnValue([
            { currency: "USD", id: "account-0" },
            { currency: "EUR", id: "account-1" },
        ]);

        const { result } = await renderHook(() => useCurrencyBlocked("account-1"));

        expect(result.current("EUR")).toBe(false);
    });

    it("still refuses a third currency on an over-cap ledger", async () => {
        mockAccounts.mockReturnValue([
            { currency: "USD", id: "account-0" },
            { currency: "EUR", id: "account-1" },
        ]);

        const { result } = await renderHook(() => useCurrencyBlocked("account-1"));

        expect(result.current("VES")).toBe(true);
    });

    it("blocks a second currency for an account that does not exist yet", async () => {
        mockAccounts.mockReturnValue([{ currency: "USD", id: "account-0" }]);

        const { result } = await renderHook(() => useCurrencyBlocked(null));

        expect(result.current("VES")).toBe(true);
    });
});
