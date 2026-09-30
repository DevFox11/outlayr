import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { AlertButton } from "react-native";

import { useDiscardGuard } from "./use-discard-guard";

type Prevented = (options: { data: { action: { type: string } } }) => void;

const mockDispatch = jest.fn();
const mockBack = jest.fn();
const mockPreventRemove = jest.fn<(prevent: boolean, callback: Prevented) => void>();

jest.mock("expo-router", () => ({
    useNavigation: () => ({ dispatch: mockDispatch }),
    useRouter: () => ({ back: mockBack }),
}));
jest.mock("expo-router/react-navigation", () => ({
    usePreventRemove: (prevent: boolean, callback: Prevented) => mockPreventRemove(prevent, callback),
}));
jest.mock("@/i18n/context", () => ({ useTranslation: () => (key: string) => key }));

const ACTION = { type: "GO_BACK" };

function lastGuard(): { callback: Prevented; prevent: boolean } {
    const [prevent, callback] = mockPreventRemove.mock.calls.at(-1) ?? [false, () => undefined];
    return { callback, prevent };
}

describe("useDiscardGuard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("lets a clean screen go", async () => {
        await renderHook(() => useDiscardGuard());

        expect(lastGuard().prevent).toBe(false);
    });

    it("asks before dropping an edit and leaves only on Discard", async () => {
        const alert = jest.spyOn(Alert, "alert").mockReturnValue(undefined);
        const { result } = await renderHook(() => useDiscardGuard());

        await act(async () => {
            result.current.setDirty(true);
        });
        expect(lastGuard().prevent).toBe(true);

        lastGuard().callback({ data: { action: ACTION } });
        expect(mockDispatch).not.toHaveBeenCalled();

        const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
        buttons.find((button) => button.style === "destructive")?.onPress?.();
        expect(mockDispatch).toHaveBeenCalledWith(ACTION);
    });

    it("does not ask when the screen leaves after a save", async () => {
        const alert = jest.spyOn(Alert, "alert").mockReturnValue(undefined);
        const { result } = await renderHook(() => useDiscardGuard());
        await act(async () => {
            result.current.setDirty(true);
        });

        result.current.leave();
        lastGuard().callback({ data: { action: ACTION } });

        expect(mockBack).toHaveBeenCalledTimes(1);
        expect(alert).not.toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(ACTION);
    });
});
