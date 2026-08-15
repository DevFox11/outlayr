import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import type { NumpadMode } from "@/domain/numpad";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { AmountNumpad } from "./amount-numpad";
import { Text } from "./text";

const mockNumberEntryType = jest.fn<() => number>(() => 2);

jest.mock("@/contexts/display-settings-context", () => ({
    useSettingNumber: () => mockNumberEntryType(),
}));
jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => () => {
        // the taptic engine has no bearing on what a keystroke produces
    },
}));

/** `Pressable`'s host view carries `onClick`, not `onPress` — see `category-picker-sheet.test.tsx`. */
async function press(label: string): Promise<void> {
    await act(async () => {
        fireEvent(screen.getByLabelText(label), "click");
    });
}

/** A parent that stores every keystroke verbatim, as all five real callers do. */
function Harness({ mode, minorUnits = 2 }: { minorUnits?: number; mode?: NumpadMode }) {
    const [value, setValue] = useState("");
    return (
        <>
            <Text testID="entry">{value}</Text>
            <AmountNumpad
                code="USD"
                minorUnits={minorUnits}
                mode={mode}
                onChange={setValue}
                showDisplay={false}
                value={value}
            />
        </>
    );
}

const entry = () => screen.getByTestId("entry").props.children;

describe("amountNumpad mode", () => {
    it("shifts digits through the minor units when the setting picks the pre-dotted keypad", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(<Harness />);

        await press("1");
        await press("2");
        await press("3");
        await press("4");

        expect(entry()).toBe("12.34");
    });

    it("hides the separator key the pre-dotted keypad has no use for", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(<Harness />);

        expect(screen.queryByLabelText(".")).toBeNull();
    });

    it("takes the separator itself when the setting picks the explicit keypad", async () => {
        mockNumberEntryType.mockReturnValue(2);
        await render(<Harness />);

        await press("1");
        await press("2");
        await press(".");
        await press("3");

        expect(entry()).toBe("12.3");
    });

    // An exchange rate is not money, so "the last two digits are cents"
    // describes nothing the user is typing there.
    it("lets a caller override the setting for a field that is not money", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(<Harness minorUnits={4} mode="explicitSeparator" />);

        await press("3");
        await press("6");
        await press(".");
        await press("5");

        expect(entry()).toBe("36.5");
    });

    it("draws the separator key an overridden explicit keypad needs", async () => {
        mockNumberEntryType.mockReturnValue(1);
        await render(<Harness minorUnits={4} mode="explicitSeparator" />);

        expect(screen.queryByLabelText(".")).not.toBeNull();
    });
});

describe("amountNumpad keystroke ordering", () => {
    /**
     * `value` is a render-time prop, so a parent that has not re-rendered yet
     * hands the second press the string from before the first one. Under
     * `preDotted` a lost digit is a tenfold error, which reads as the setting
     * misbehaving rather than as a dropped tap.
     */
    it("chains presses that land before the owner has re-rendered", async () => {
        mockNumberEntryType.mockReturnValue(2);
        const onChange = jest.fn();
        await render(<AmountNumpad code="USD" minorUnits={2} onChange={onChange} showDisplay={false} value="" />);

        await press("1");
        await press("2");
        await press("3");

        expect(onChange.mock.calls.map(([next]) => next)).toStrictEqual(["1", "12", "123"]);
    });

    it("restarts from the value once a render has caught up", async () => {
        mockNumberEntryType.mockReturnValue(2);
        await render(<Harness />);

        await press("1");
        await press("2");

        expect(entry()).toBe("12");
    });
});
