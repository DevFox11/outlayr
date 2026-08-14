import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

jest.mock<Partial<typeof import("expo-localization")>>("expo-localization", () => ({
    getLocales: jest.fn<typeof import("expo-localization").getLocales>(),
}));

import { getLocales } from "expo-localization";

import { testLocale as mockTestLocale } from "@/i18n/test-locale";

import { useDeviceLanguageTag } from "./device-language";

const mockGetLocales = jest.mocked(getLocales);

/** The hook reads only the first locale's `languageTag`. */
const mockDeviceLanguageTag = {
    mockImplementation: (fn: () => string) =>
        // oxlint-disable-next-line jest/prefer-mock-return-shorthand -- `mockReturnValue` would call `fn` here at setup, and one caller passes a `fn` that throws to exercise the failure path
        mockGetLocales.mockImplementation(() => [mockTestLocale({ languageTag: fn() })]),
    mockReset: () => mockGetLocales.mockReset(),
    mockReturnValue: (tag: string) => mockGetLocales.mockReturnValue([mockTestLocale({ languageTag: tag })]),
};

const realAddEventListener = AppState.addEventListener;

/**
 * Captures every listener the hook registers so a test can drive AppState
 * transitions directly, and reports whether each was later removed.
 */
function watchAppState() {
    const listeners: ((status: AppStateStatus) => void)[] = [];
    const remove = jest.fn();

    // Assigned rather than spied: `jest.restoreAllMocks` also reverts the
    // `language-storage` module mock, and restoring spies one at a time still
    // left a later test running an earlier test's implementation.
    AppState.addEventListener = ((event: string, listener: unknown) => {
        if (event === "change") {
            listeners.push(listener as (status: AppStateStatus) => void);
        }
        return { remove };
    }) as typeof AppState.addEventListener;

    return {
        async emit(status: AppStateStatus) {
            await act(async () => {
                for (const listener of listeners) {
                    listener(status);
                }
            });
        },
        remove,
    };
}

afterEach(() => {
    AppState.addEventListener = realAddEventListener;
    mockDeviceLanguageTag.mockReset();
});

describe("useDeviceLanguageTag", () => {
    it("returns the tag read at mount", async () => {
        watchAppState();
        mockDeviceLanguageTag.mockReturnValue("en-US");

        const { result } = await renderHook(() => useDeviceLanguageTag());

        expect(result.current).toBe("en-US");
    });

    it("re-reads the tag when the app returns to the foreground", async () => {
        const appState = watchAppState();
        mockDeviceLanguageTag.mockReturnValue("en-US");
        const { result } = await renderHook(() => useDeviceLanguageTag());

        mockDeviceLanguageTag.mockReturnValue("es-MX");
        await appState.emit("active");

        expect(result.current).toBe("es-MX");
    });

    it("does not re-read while the app is heading to the background", async () => {
        const appState = watchAppState();
        mockDeviceLanguageTag.mockReturnValue("en-US");
        const { result } = await renderHook(() => useDeviceLanguageTag());

        mockDeviceLanguageTag.mockReturnValue("es-MX");
        await appState.emit("background");

        expect(result.current).toBe("en-US");
    });

    it("notifies every mounted consumer, not just the first", async () => {
        const appState = watchAppState();
        mockDeviceLanguageTag.mockReturnValue("en-US");
        const first = await renderHook(() => useDeviceLanguageTag());
        const second = await renderHook(() => useDeviceLanguageTag());

        mockDeviceLanguageTag.mockReturnValue("es-MX");
        await appState.emit("active");

        expect(first.result.current).toBe("es-MX");
        expect(second.result.current).toBe("es-MX");
    });

    it("returns null rather than throwing when the platform call fails", async () => {
        watchAppState();
        mockDeviceLanguageTag.mockImplementation(() => {
            throw new Error("boom");
        });

        const { result } = await renderHook(() => useDeviceLanguageTag());

        expect(result.current).toBeNull();
    });

    it("removes its AppState subscription on unmount", async () => {
        const appState = watchAppState();
        mockDeviceLanguageTag.mockReturnValue("en-US");

        const { unmount } = await renderHook(() => useDeviceLanguageTag());
        await act(async () => {
            unmount();
        });

        expect(appState.remove).toHaveBeenCalledWith();
    });
});
