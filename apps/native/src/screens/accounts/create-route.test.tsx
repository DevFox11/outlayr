import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { FREE_ACCOUNTS } from "@/domain/pro-limits";

const mockAccounts = jest.fn<() => { currency: string; id: string }[]>();
jest.mock("@/contexts/local-data-context", () => ({ useDatabase: () => null }));
jest.mock("@/data/accounts", () => ({ useAccounts: () => mockAccounts() }));
jest.mock("@/lib/convex", () => ({ convex: {} }));

const mockRevenueCat = { isConfigured: true, isMirrored: false, isPro: false, isResolved: true };
jest.mock("@/contexts/revenuecat-context", () => ({ useRevenueCat: () => mockRevenueCat }));

const label = (text: string) => {
    const Stub = () => {
        const { createElement } = require("react") as typeof import("react");
        const { Text } = require("react-native") as typeof import("react-native");
        return createElement(Text, null, text);
    };
    Stub.displayName = text;
    return Stub;
};
jest.mock("expo-router", () => ({ Redirect: label("paywall") }));
jest.mock("@/components/account-editor", () => ({ __esModule: true, default: label("editor") }));
jest.mock("@/components/close-toolbar", () => ({ CloseToolbar: () => null }));

import AccountCreateScreen from "@/app/accounts/create";

const accounts = (count: number) => Array.from({ length: count }, (_, i) => ({ currency: "USD", id: `a${i}` }));

describe("accountCreateScreen", () => {
    beforeEach(() => {
        mockRevenueCat.isPro = false;
        mockRevenueCat.isResolved = true;
    });

    it("sends an owner already at the cap to the paywall", async () => {
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));

        const { getByText } = await render(<AccountCreateScreen />);

        expect(getByText("paywall")).toBeTruthy();
    });

    it("keeps the form open when the store answers mid-edit", async () => {
        mockRevenueCat.isResolved = false;
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));

        const { getByText, queryByText, rerender } = await render(<AccountCreateScreen />);
        expect(getByText("editor")).toBeTruthy();

        mockRevenueCat.isResolved = true;
        await rerender(<AccountCreateScreen />);

        expect(getByText("editor")).toBeTruthy();
        expect(queryByText("paywall")).toBeNull();
    });

    it("keeps the form open when a sync lands the account that reaches the cap", async () => {
        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS - 1));

        const { getByText, queryByText, rerender } = await render(<AccountCreateScreen />);
        expect(getByText("editor")).toBeTruthy();

        mockAccounts.mockReturnValue(accounts(FREE_ACCOUNTS));
        await rerender(<AccountCreateScreen />);

        expect(queryByText("paywall")).toBeNull();
    });
});
