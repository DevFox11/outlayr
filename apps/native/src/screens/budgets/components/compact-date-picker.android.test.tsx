import type { DatePickerDialogProps } from "@expo/ui/jetpack-compose";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { testMaterialColors as mockTestMaterialColors } from "@/theme/test-colors";

import { CompactDatePicker } from "./compact-date-picker";

/** What Material 3 reports for a picked day: that day's UTC midnight. */
const mockPickedUtcDay = new Date(Date.UTC(2026, 11, 24));

// Stands in for the Compose dialog: on screen while mounted, showing the day it
// opened on, with its two ways out.
jest.mock("@expo/ui/jetpack-compose", () => {
    const { Pressable, Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
    return {
        DatePickerDialog: ({ initialDate, onDateSelected, onDismissRequest }: DatePickerDialogProps) => (
            <View testID="date-dialog">
                <Text>{initialDate}</Text>
                <Pressable onPress={() => onDateSelected?.(mockPickedUtcDay)}>
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
jest.mock<typeof import("@/theme/use-material-colors")>("@/theme/use-material-colors", () => ({
    useMaterialColors: () => mockTestMaterialColors(),
}));

/** 9:15 in the evening, local: late enough that a UTC slip would change the day in the Americas. */
const VALUE = new Date(2026, 9, 14, 21, 15);

describe("compactDatePicker on Android", () => {
    it("opens the dialog on the value's own local day", async () => {
        await render(<CompactDatePicker label="From" onChange={jest.fn()} range={{}} value={VALUE} />);

        expect(screen.getByTestId("date-dialog")).toHaveTextContent(/^2026-10-14T00:00:00\.000Z/);
    });

    it("hands back the picked day at the value's time of day, and closes", async () => {
        const onChange = jest.fn();
        await render(<CompactDatePicker label="From" onChange={onChange} range={{}} value={VALUE} />);

        await fireEvent.press(screen.getByText("OK"));

        expect(onChange).toHaveBeenCalledWith(new Date(2026, 11, 24, 21, 15));
        expect(screen.queryByTestId("date-dialog")).toBeNull();
    });

    it("closes on cancel, says so, and the field opens it again", async () => {
        const onDismiss = jest.fn();
        await render(
            <CompactDatePicker label="From" onChange={jest.fn()} onDismiss={onDismiss} range={{}} value={VALUE} />
        );

        await fireEvent.press(screen.getByText("Cancel"));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("date-dialog")).toBeNull();

        await fireEvent.press(screen.getByRole("button", { name: "From, 14 Oct 2026" }));
        expect(screen.getByTestId("date-dialog")).toBeOnTheScreen();
    });
});
