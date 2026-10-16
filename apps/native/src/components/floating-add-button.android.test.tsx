import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { Ref } from "react";
import { BackHandler } from "react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { FloatingAddButton } from "./floating-add-button.android";

const mockPush = jest.fn();
const mockSetStep = jest.fn();
const mockPresent = jest.fn();
const mockAccounts = jest.fn(() => [{ id: "a" }, { id: "b" }]);
/** Whether the Log is the tab on screen. Flip it to leave the tab. */
const mockIsFocused = jest.fn(() => true);

jest.mock("expo-router", () => ({
    router: { push: (...args: unknown[]) => mockPush(...args) },
    // Mirrors the real hook: the callback runs while the tab is on screen, and
    // its cleanup fires when focus leaves.
    useFocusEffect: (callback: () => () => void) => {
        const { useEffect } = require("react");
        const focused = mockIsFocused();
        useEffect(() => (focused ? callback() : undefined), [callback, focused]);
    },
}));
jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));
jest.mock("@/data/accounts", () => ({
    useAccounts: () => mockAccounts(),
}));
jest.mock("@/lib/import-draft-store", () => ({
    importDraftStore: {
        getResumeStep: () => "source",
        setStep: (...args: unknown[]) => mockSetStep(...args),
    },
}));
jest.mock("@/components/import-sheet/import-sheet", () => {
    const { useImperativeHandle } = require("react");
    return {
        ImportSheet: ({ ref }: { ref?: Ref<unknown> }) => {
            useImperativeHandle(ref, () => ({ dismiss: jest.fn(), present: mockPresent }));
            return null;
        },
    };
});
jest.mock("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
// React Native's own mock reports a font scale of 2; the fit test sizes items at 1.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
    __esModule: true,
    default: () => ({ fontScale: 1, height: 915, scale: 2.625, width: 412 }),
}));
jest.mock("@/theme/use-material-colors", () => ({
    useMaterialColors: () =>
        new Proxy(
            {},
            {
                get: () => "#336699",
            }
        ),
}));

async function press(element: Parameters<typeof fireEvent.press>[0]) {
    await act(async () => {
        fireEvent.press(element);
    });
}

const openMenu = () => press(screen.getByLabelText("log.add.menu"));
const menuOpen = () => screen.getByLabelText("log.add.menu").props.accessibilityState.expanded;
const menuLabels = () => screen.getAllByText(/^log\.add\./).map((label) => label.props.children);

/** Lays the screen's content area out at `height`, which is what the menu has to fit in. */
async function layOutContent(height: number) {
    await act(async () => {
        fireEvent(screen.getByTestId("fab-room"), "layout", {
            nativeEvent: { layout: { height, width: 412, x: 0, y: 0 } },
        });
    });
}

describe("floatingAddButton on Android", () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockSetStep.mockClear();
        mockPresent.mockClear();
        mockAccounts.mockReturnValue([{ id: "a" }, { id: "b" }]);
        mockIsFocused.mockReturnValue(true);
    });

    it("stacks the most-wanted action nearest the FAB", async () => {
        await render(<FloatingAddButton />);
        expect(screen.queryByLabelText("log.add.transaction")).toBeNull();

        await openMenu();

        expect(menuLabels()).toStrictEqual([
            "log.add.import",
            "log.add.scan",
            "log.add.voice",
            "log.add.transfer",
            "log.add.transaction",
        ]);
    });

    it("pushes the entry once and closes the menu behind it", async () => {
        await render(<FloatingAddButton />);
        await openMenu();

        await press(screen.getByLabelText("log.add.transaction"));
        await openMenu();
        await press(screen.getByLabelText("log.add.transaction"));

        expect(mockPush).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith("/transactions/create");
        expect(menuOpen()).toBe(false);
    });

    it("presents the import sheet at the resume step instead of navigating", async () => {
        await render(<FloatingAddButton />);
        await openMenu();

        await press(screen.getByLabelText("log.add.import"));

        expect(mockSetStep).toHaveBeenCalledWith("source");
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("closes on system back before the back leaves the screen", async () => {
        const addListener = jest.spyOn(BackHandler, "addEventListener");
        await render(<FloatingAddButton />);
        await openMenu();

        const onBack = addListener.mock.lastCall?.[1];
        let handled: boolean | null | undefined = false;
        await act(async () => {
            handled = onBack?.({ timeStamp: 0, type: "hardwareBackPress" });
        });

        expect(handled).toBe(true);
        expect(menuOpen()).toBe(false);
    });

    it("drops the least-reached-for actions when the content area is too short", async () => {
        // A phone on its side: room for three items above the FAB.
        await render(<FloatingAddButton />);
        await layOutContent(280);
        await openMenu();

        expect(menuLabels()).toStrictEqual(["log.add.voice", "log.add.transfer", "log.add.transaction"]);
    });

    it("closes when the Log stops being the tab on screen", async () => {
        const { rerender } = await render(<FloatingAddButton />);
        await openMenu();

        mockIsFocused.mockReturnValue(false);
        await act(async () => {
            rerender(<FloatingAddButton />);
        });

        expect(menuOpen()).toBe(false);
    });
});
