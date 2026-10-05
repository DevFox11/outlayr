import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { AppLockGate } from "./app-lock-gate";

const mockLockOn = jest.fn(() => false);
const mockRequestUnlock = jest.fn(async () => ({ error: "user_cancel", success: false }) as const);

jest.mock("@/contexts/display-settings-context", () => ({
    useAppSettings: () => ({ state: { bool: () => mockLockOn() } }),
}));
jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<Partial<typeof import("@/lib/app-lock")>>("@/lib/app-lock", () => ({
    lockIsEnforceable: async () => true,
    requestUnlock: () => mockRequestUnlock(),
}));

const gate = () => (
    <AppLockGate>
        <Text>ledger</Text>
    </AppLockGate>
);

const shut = () => screen.queryByText("transaction.lock.title") !== null;

beforeEach(() => {
    mockRequestUnlock.mockClear();
});

describe("appLockGate", () => {
    it("shuts and prompts once on a launch with the lock already on", async () => {
        mockLockOn.mockReturnValue(true);
        await render(gate());

        expect(shut()).toBe(true);
        expect(mockRequestUnlock).toHaveBeenCalledTimes(1);
    });

    it("stays open without a prompt when the lock is turned on in Settings", async () => {
        mockLockOn.mockReturnValue(false);
        const { rerender } = await render(gate());

        mockLockOn.mockReturnValue(true);
        await act(async () => {
            rerender(gate());
        });

        expect(shut()).toBe(false);
        expect(mockRequestUnlock).not.toHaveBeenCalled();
    });

    it("opens when the lock is turned off while shut", async () => {
        mockLockOn.mockReturnValue(true);
        const { rerender } = await render(gate());
        expect(shut()).toBe(true);

        mockLockOn.mockReturnValue(false);
        await act(async () => {
            rerender(gate());
        });

        expect(shut()).toBe(false);
    });
});
