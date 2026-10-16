import type { DateTimePickerProps } from "@expo/ui/community/datetime-picker";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { ReminderTimeRow } from "./reminder-time-row";

const mockPicked = new Date(2026, 9, 14, 7, 45);

// Stands in for the Material dialog: on screen for as long as it is mounted,
// with its two ways out.
jest.mock<typeof import("@expo/ui/community/datetime-picker")>("@expo/ui/community/datetime-picker", () => {
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
    function DateTimePicker({ onDismiss, onValueChange }: DateTimePickerProps) {
        return (
            <View testID="time-dialog">
                <Pressable
                    onPress={() =>
                        onValueChange?.(
                            {
                                nativeEvent: {
                                    timestamp: mockPicked.getTime(),
                                    utcOffset: -mockPicked.getTimezoneOffset(),
                                },
                            },
                            mockPicked
                        )
                    }
                >
                    <Text>OK</Text>
                </Pressable>
                <Pressable onPress={onDismiss}>
                    <Text>Cancel</Text>
                </Pressable>
            </View>
        );
    }
    return { DateTimePicker, default: DateTimePicker };
});

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ use24Hour: true }),
}));

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({}),
}));

async function openDialog(onChange = jest.fn()) {
    await render(<ReminderTimeRow onChange={onChange} value={{ hour: 20, minute: 30 }} />);
    await fireEvent.press(screen.getByText("settings.notifications.time"));
    return onChange;
}

describe("reminderTimeRow on Android", () => {
    it("shows the time and keeps the dialog unmounted until the row is pressed", async () => {
        await render(<ReminderTimeRow onChange={jest.fn()} value={{ hour: 20, minute: 30 }} />);

        expect(screen.getByText("20:30")).toBeOnTheScreen();
        expect(screen.queryByTestId("time-dialog")).toBeNull();
    });

    it("closes the dialog on a pick and hands back the time", async () => {
        const onChange = await openDialog();

        await fireEvent.press(screen.getByText("OK"));

        expect(onChange).toHaveBeenCalledWith({ hour: 7, minute: 45 });
        expect(screen.queryByTestId("time-dialog")).toBeNull();
    });

    it("closes the dialog on cancel without changing the time", async () => {
        const onChange = await openDialog();

        await fireEvent.press(screen.getByText("Cancel"));

        expect(onChange).not.toHaveBeenCalled();
        expect(screen.queryByTestId("time-dialog")).toBeNull();
    });
});
