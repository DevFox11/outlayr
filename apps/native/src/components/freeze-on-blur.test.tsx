import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { useEffect, useSyncExternalStore } from "react";
import { Text } from "react-native";

import { FreezeOnBlur } from "./freeze-on-blur";

const mockFocus = { current: true };
const mockFocusListeners = new Set<() => void>();
const mockSegments = { current: ["(tabs)", "insights"] };
const mockTheme = { current: "light" };

jest.mock<Partial<typeof import("expo-router")>>("expo-router", () => ({
    useIsFocused: () => {
        const { useSyncExternalStore: subscribeToFocus } = jest.requireActual<typeof import("react")>("react");
        return subscribeToFocus(
            (notify: () => void) => {
                mockFocusListeners.add(notify);
                return () => {
                    mockFocusListeners.delete(notify);
                };
            },
            () => mockFocus.current
        );
    },
    useSegments: () => mockSegments.current as never,
}));
jest.mock<Partial<typeof import("uniwind")>>("uniwind", () => ({
    useUniwind: () => ({ hasAdaptiveThemes: false, theme: mockTheme.current as never }),
}));
jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useSettingNumber: () => 0,
}));

async function setFocus(next: boolean) {
    mockFocus.current = next;
    await act(async () => {
        // oxlint-disable-next-line unicorn/no-useless-spread -- mirrors the copy the real subscriber list is iterated over
        for (const notify of [...mockFocusListeners]) {
            notify();
        }
    });
    // The freeze is deferred a macrotask so it cannot land mid-transition.
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

const ticker = { listeners: new Set<() => void>(), value: "first" };

async function tick(next: string) {
    ticker.value = next;
    await act(async () => {
        // oxlint-disable-next-line unicorn/no-useless-spread -- mirrors the copy the real subscriber list is iterated over
        for (const notify of [...ticker.listeners]) {
            notify();
        }
    });
}

let renders = 0;
let mounts = 0;

function Screen() {
    const value = useSyncExternalStore(
        (notify) => {
            ticker.listeners.add(notify);
            return () => {
                ticker.listeners.delete(notify);
            };
        },
        () => ticker.value
    );
    renders += 1;
    useEffect(() => {
        mounts += 1;
    }, []);
    return <Text testID="screen">{value}</Text>;
}

describe("freezeOnBlur", () => {
    beforeEach(() => {
        mockFocus.current = true;
        mockFocusListeners.clear();
        mockSegments.current = ["(tabs)", "insights"];
        mockTheme.current = "light";
        mounts = 0;
        ticker.value = "first";
        ticker.listeners.clear();
        renders = 0;
    });

    it("renders normally while the tab is focused", async () => {
        const { getByTestId } = await render(
            <FreezeOnBlur>
                <Screen />
            </FreezeOnBlur>
        );
        await waitFor(() => expect(getByTestId("screen").props.children).toBe("first"));

        await tick("second");

        expect(getByTestId("screen").props.children).toBe("second");
    });

    it("does not render the screen while the tab is blurred", async () => {
        await render(
            <FreezeOnBlur>
                <Screen />
            </FreezeOnBlur>
        );
        await setFocus(false);
        const whileBlurred = renders;

        await tick("second");
        await tick("third");

        expect(renders).toBe(whileBlurred);
    });

    it("keeps rendering under a screen opened over the tabs", async () => {
        const { getByTestId } = await render(
            <FreezeOnBlur>
                <Screen />
            </FreezeOnBlur>
        );
        mockSegments.current = ["transactions", "[id]"];
        await setFocus(false);

        await tick("second");

        expect(getByTestId("screen").props.children).toBe("second");
    });

    it("remounts a tab whose theme changed while it was frozen, and only then", async () => {
        await render(
            <FreezeOnBlur>
                <Screen />
            </FreezeOnBlur>
        );
        await setFocus(false);
        await setFocus(true);
        expect(mounts).toBe(1);

        mockTheme.current = "dark";
        await setFocus(true);
        expect(mounts).toBe(1);

        await setFocus(false);
        mockTheme.current = "light";
        await setFocus(true);

        expect(mounts).toBe(2);
    });

    it("catches up to the current value on return, without remounting", async () => {
        const { getByTestId } = await render(
            <FreezeOnBlur>
                <Screen />
            </FreezeOnBlur>
        );
        await setFocus(false);
        await tick("second");
        await tick("third");

        await setFocus(true);

        await waitFor(() => expect(getByTestId("screen").props.children).toBe("third"));
        // One catch-up render, not one per missed tick.
        expect(renders).toBe(2);
    });
});
