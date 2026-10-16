import type { MenuComponentProps, MenuComponentRef } from "@expo/ui/community/menu";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Ref } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { PickerRow } from "./picker-row";

const mockShow = jest.fn();

// The real menu is a Compose dropdown that only mounts its items once open.
// This one lists them all up front, with the trailing check the real one draws.
jest.mock<typeof import("@expo/ui/community/menu")>("@expo/ui/community/menu", () => {
    const { useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
    function MenuView({ actions, children, onPressAction, ref }: MenuComponentProps & { ref?: Ref<MenuComponentRef> }) {
        useImperativeHandle(ref, () => ({ show: mockShow }));
        return (
            <View>
                {children}
                {actions.map((action) => (
                    <Pressable
                        accessibilityRole="menuitem"
                        key={action.id}
                        onPress={() => onPressAction?.({ nativeEvent: { event: action.id ?? action.title } })}
                    >
                        <Text>{action.title}</Text>
                        {action.state === "on" ? <Text>✓</Text> : null}
                    </Pressable>
                ))}
            </View>
        );
    }
    return { MenuView, default: MenuView };
});

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({}),
}));

const OPTIONS = [
    { label: "System", value: 0 },
    { label: "Light", value: 1 },
    { label: "Dark", value: 2 },
] as const;

describe("pickerRow on Android", () => {
    beforeEach(() => {
        mockShow.mockClear();
    });

    it("announces the current choice and checks it in the menu", async () => {
        await render(<PickerRow icon="DarkMode" onChange={jest.fn()} options={OPTIONS} title="Appearance" value={1} />);

        expect(screen.getByRole("button", { name: "Appearance, Light" })).toBeOnTheScreen();
        expect(screen.getByRole("menuitem", { name: "Light ✓" })).toBeOnTheScreen();
        expect(screen.getByRole("menuitem", { name: "Dark" })).toBeOnTheScreen();
    });

    it("hands back the picked option's own value, not its string id", async () => {
        const onChange = jest.fn();
        await render(<PickerRow icon="DarkMode" onChange={onChange} options={OPTIONS} title="Appearance" value={1} />);

        await fireEvent.press(screen.getByRole("menuitem", { name: "Dark" }));

        expect(onChange).toHaveBeenCalledWith(2);
    });

    it("opens the menu from anywhere on the row", async () => {
        await render(<PickerRow icon="DarkMode" onChange={jest.fn()} options={OPTIONS} title="Appearance" value={1} />);

        await fireEvent.press(screen.getByRole("button", { name: "Appearance, Light" }));

        expect(mockShow).toHaveBeenCalledTimes(1);
    });
});
