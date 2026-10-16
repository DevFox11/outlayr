import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { testMaterialColors as mockTestMaterialColors } from "@/theme/test-colors";

import { ChoiceRow, LinkRow, ToggleRow } from "./list-row";

// Compose views have no jest renderer. These stand-ins act like the real
// controls: each runs its own handler, if the row gave it one, when tapped.
jest.mock("@expo/ui/jetpack-compose", () => {
    const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return {
        RadioButton: ({ onClick, selected }: { onClick?: () => void; selected: boolean }) => (
            <Pressable onPress={() => onClick?.()} testID="compose-radio">
                <Text>{selected ? "(•)" : "( )"}</Text>
            </Pressable>
        ),
        Switch: ({ onCheckedChange, value }: { onCheckedChange?: (next: boolean) => void; value: boolean }) => (
            <Pressable onPress={() => onCheckedChange?.(!value)} testID="compose-switch">
                <Text>{value ? "on" : "off"}</Text>
            </Pressable>
        ),
    };
});

/**
 * One finger on the Compose control, as on a device: the control sees the tap
 * and so does the row's Pressable around it. Hidden from TalkBack, which reads
 * the row, so the query includes hidden elements.
 */
async function tapControl(testID: string, row: Parameters<typeof fireEvent.press>[0]) {
    await fireEvent.press(screen.getByTestId(testID, { includeHiddenElements: true }));
    await fireEvent.press(row);
}
jest.mock("@/components/material-host", () => ({
    MaterialHost: ({ children }: { children: ReactNode }) => children,
}));
jest.mock<typeof import("@/theme/use-material-colors")>("@/theme/use-material-colors", () => ({
    useMaterialColors: () => mockTestMaterialColors(),
}));

describe("list rows on Android", () => {
    it("puts a link row's value under its title", async () => {
        await render(<LinkRow icon="Currency" onPress={jest.fn()} title="Currency" value="USD" />);

        expect(screen.getByRole("button")).toHaveTextContent("CurrencyUSD");
    });

    it("toggles from anywhere on the row, and announces itself as the switch", async () => {
        const onValueChange = jest.fn();
        await render(<ToggleRow icon="BadgeCent" onValueChange={onValueChange} title="Show cents" value={false} />);

        await fireEvent.press(screen.getByRole("switch", { name: "Show cents" }));

        expect(onValueChange).toHaveBeenCalledWith(true);
        expect(screen.getByRole("switch")).not.toBeChecked();
    });

    it("changes once for a tap on the switch itself", async () => {
        const onValueChange = jest.fn();
        await render(<ToggleRow icon="BadgeCent" onValueChange={onValueChange} title="Show cents" value />);

        await tapControl("compose-switch", screen.getByRole("switch", { name: "Show cents" }));

        expect(onValueChange.mock.calls).toStrictEqual([[false]]);
    });

    it("draws a choice as a radio, checked when it is the selection", async () => {
        const onPress = jest.fn();
        await render(
            <>
                <ChoiceRow label="1st" onPress={onPress} selected />
                <ChoiceRow label="2nd" onPress={onPress} selected={false} />
            </>
        );

        expect(screen.getByRole("radio", { name: "1st" })).toBeChecked();
        await fireEvent.press(screen.getByRole("radio", { name: "2nd" }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("chooses once for a tap on the radio itself", async () => {
        const onPress = jest.fn();
        await render(<ChoiceRow label="2nd" onPress={onPress} selected={false} />);

        await tapControl("compose-radio", screen.getByRole("radio", { name: "2nd" }));

        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
