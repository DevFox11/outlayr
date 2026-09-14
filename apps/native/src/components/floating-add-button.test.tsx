import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { Ref } from "react";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { FloatingAddButton } from "./floating-add-button";

const mockPush = jest.fn();
const mockGetResumeStep = jest.fn(() => "source");
const mockSetStep = jest.fn();
const mockPresent = jest.fn();
const mockAccounts = jest.fn(() => [{ id: "a" }, { id: "b" }]);
/** The QA sim in portrait. Overridden per-test to stand the window on its side. */
const mockWindowHeight = jest.fn(() => 956);
/** Dynamic Type multiplier. 1 is a device that has not scaled its text. */
const mockFontScale = jest.fn(() => 1);
/** Whether the Log is the tab on screen. Flip it to leave the tab. */
const mockIsFocused = jest.fn(() => true);
const mockHaptics = jest.fn();

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
        getResumeStep: () => mockGetResumeStep(),
        setStep: (...args: unknown[]) => mockSetStep(...args),
    },
}));
jest.mock("@/components/import-sheet/import-sheet", () => {
    const { useImperativeHandle } = require("react");
    return {
        ImportSheet: ({ ref }: { ref?: Ref<unknown> }) => {
            useImperativeHandle(ref, () => ({
                dismiss: jest.fn(),
                present: mockPresent,
            }));
            return null;
        },
    };
});
jest.mock("@/lib/use-haptics", () => ({
    useHaptics: () => mockHaptics,
}));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
    __esModule: true,
    default: () => ({ fontScale: mockFontScale(), height: mockWindowHeight(), scale: 3, width: 440 }),
}));

/**
 * Opening is a state change behind an animation, so the press has to be flushed
 * before the actions it mounts can be queried.
 */
async function press(element: Parameters<typeof fireEvent.press>[0]) {
    await act(async () => {
        fireEvent.press(element);
    });
}

/**
 * Actions are reached by accessibility label, never by their text. A dial action
 * is a circle with its name in a chip *beside* it, so the chip is a sibling of
 * the pressable rather than inside it, and a press on the text goes nowhere.
 */
const openDial = () => press(screen.getByLabelText("log.add.menu"));
const pressAction = (label: string) => press(screen.getByLabelText(label));

/**
 * Closed is read off the trigger, not off the actions: panelui keeps them
 * mounted while the closing spring runs, and under jest that spring never
 * reports finishing.
 */
const dialExpanded = () => screen.getByLabelText("log.add.menu").props.accessibilityState.expanded;

describe("floatingAddButton", () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockGetResumeStep.mockClear();
        mockSetStep.mockClear();
        mockPresent.mockClear();
        mockGetResumeStep.mockReturnValue("source");
        mockAccounts.mockReturnValue([{ id: "a" }, { id: "b" }]);
        mockWindowHeight.mockReturnValue(956);
        mockFontScale.mockReturnValue(1);
        mockIsFocused.mockReturnValue(true);
        mockHaptics.mockClear();
    });

    it("renders through uniwind + expo-router + panelui together", async () => {
        const { toJSON } = await render(<FloatingAddButton />);
        expect(toJSON()).toBeTruthy();
    });

    it("keeps the actions out of the tree until the dial is opened", async () => {
        await render(<FloatingAddButton />);

        expect(screen.queryByLabelText("log.add.transaction")).toBeNull();

        await openDial();

        expect(screen.getByLabelText("log.add.transaction")).toBeTruthy();
    });

    it("stacks the most-wanted action nearest the trigger", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        // Tree order is top-to-bottom on screen and the dial grows upward from
        // the trigger, so this list is the priority order read backwards.
        expect(screen.getAllByText(/^log\.add\./).map((chip) => chip.props.children)).toStrictEqual([
            "log.add.import",
            "log.add.scan",
            "log.add.voice",
            "log.add.transfer",
            "log.add.transaction",
        ]);
    });

    it("pushes /transactions/create when the transaction action is pressed", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.transaction");

        expect(mockPush).toHaveBeenCalledWith("/transactions/create");
    });

    it("shuts the dial behind the action it just ran", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.transaction");

        expect(dialExpanded()).toBe(false);
    });

    it("seeds the resume step and presents the sheet when the import action is pressed", async () => {
        mockGetResumeStep.mockReturnValue("resolve");
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.import");

        expect(mockSetStep).toHaveBeenCalledWith("resolve");
        expect(mockPresent).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("presents at the source step when nothing is in progress", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.import");

        expect(mockSetStep).toHaveBeenCalledWith("source");
        expect(mockPresent).toHaveBeenCalledTimes(1);
    });

    it("offers a transfer once there are two accounts to move between", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.transfer");

        expect(mockPush).toHaveBeenCalledWith("/transactions/transfers/create");
    });

    it("hides the transfer action with only one account, since both legs are required", async () => {
        mockAccounts.mockReturnValue([{ id: "a" }]);
        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.queryByLabelText("log.add.transfer")).toBeNull();
    });

    it("hides it with no accounts at all", async () => {
        mockAccounts.mockReturnValue([]);
        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.queryByLabelText("log.add.transfer")).toBeNull();
    });

    it("drops the least-reached-for actions when the window is too short to hold them", async () => {
        // An iPhone on its side. Five actions need 404pt above the bottom inset
        // and the dial cannot scroll, so the top of the column would be off-screen.
        mockWindowHeight.mockReturnValue(440);

        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.getAllByText(/^log\.add\./).map((chip) => chip.props.children)).toStrictEqual([
            "log.add.voice",
            "log.add.transfer",
            "log.add.transaction",
        ]);
    });

    it("keeps every action that fits once the window is tall again", async () => {
        mockWindowHeight.mockReturnValue(956);

        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.getByLabelText("log.add.import")).toBeTruthy();
    });

    it("shuts the dial when the Log stops being the tab on screen", async () => {
        // The scrim leaves the tab bar tappable and NativeTabs keeps the Log
        // mounted, so an open dial would otherwise still be there on return.
        const { rerender } = await render(<FloatingAddButton />);
        await openDial();
        expect(screen.getByLabelText("log.add.transaction")).toBeTruthy();

        mockIsFocused.mockReturnValue(false);
        await act(async () => {
            rerender(<FloatingAddButton />);
        });

        expect(dialExpanded()).toBe(false);
    });

    it("ticks through the app's haptics wrapper, which reads the Haptics setting", async () => {
        // panelui's own `haptics` prop calls the taptic engine directly and would
        // buzz straight through Settings -> Haptics -> None.
        await render(<FloatingAddButton />);
        await openDial();

        expect(mockHaptics).toHaveBeenCalledWith("selection");
    });

    it("clamps the labels when Dynamic Type wraps them tall, keeping every action", async () => {
        // An accessibility text size wraps each chip to three lines, which makes a
        // row roughly four times its resting height even in portrait.
        mockFontScale.mockReturnValue(3.1);

        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.getAllByText(/^log\.add\./).map((chip) => chip.props.children)).toStrictEqual([
            "log.add.import",
            "log.add.scan",
            "log.add.voice",
            "log.add.transfer",
            "log.add.transaction",
        ]);
    });

    it("clamps the labels rather than dropping a working action", async () => {
        // An iPhone in landscape at an accessibility text size: ~331pt of room for
        // a column the four runnable actions want ~940pt for at full height. The
        // second and third label lines are given up before any command is, and
        // only then the import, so the three most-wanted commands survive.
        mockWindowHeight.mockReturnValue(440);
        mockFontScale.mockReturnValue(3.1);

        await render(<FloatingAddButton />);
        await openDial();

        expect(screen.getAllByText(/^log\.add\./).map((chip) => chip.props.children)).toStrictEqual([
            "log.add.voice",
            "log.add.transfer",
            "log.add.transaction",
        ]);
    });

    it("pushes /transactions/voice when the voice action is pressed", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.voice");

        expect(mockPush).toHaveBeenCalledWith("/transactions/voice");
    });

    it("pushes /transactions/scan when the scan action is pressed", async () => {
        await render(<FloatingAddButton />);
        await openDial();

        await pressAction("log.add.scan");

        expect(mockPush).toHaveBeenCalledWith("/transactions/scan");
    });
});
