import type { TimePickerDialogProps } from "@expo/ui/jetpack-compose";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { testDisplaySettingsValue as mockTestDisplaySettingsValue } from "@/contexts/test-settings";
import { testMaterialColors as mockTestMaterialColors } from "@/theme/test-colors";

import { ReminderTimeRow } from "./reminder-time-row";

const mockPicked = new Date(2026, 9, 14, 7, 45);

// Stands in for the Material dialog: on screen for as long as it is mounted,
// with its two ways out.
jest.mock("@expo/ui/jetpack-compose", () => {
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
    return {
        TimePickerDialog: ({ onDateSelected, onDismissRequest }: TimePickerDialogProps) => (
            <View testID="time-dialog">
                <Pressable onPress={() => onDateSelected?.(mockPicked)}>
                    <Text>OK</Text>
                </Pressable>
                <Pressable onPress={onDismissRequest}>
                    <Text>Cancel</Text>
                </Pressable>
            </View>
        ),
    };
});
jest.mock("@/components/material-host", () => ({
    MaterialHost: ({ children }: { children: ReactNode }) => children,
}));

jest.mock<Partial<typeof import("@/contexts/display-settings-context")>>("@/contexts/display-settings-context", () => ({
    useDisplaySettings: () => mockTestDisplaySettingsValue({ use24Hour: true }),
}));

jest.mock<typeof import("@/theme/use-material-colors")>("@/theme/use-material-colors", () => ({
    useMaterialColors: () => mockTestMaterialColors(),
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
