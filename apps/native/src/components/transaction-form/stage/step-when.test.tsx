import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepWhen } from "./step-when";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const NOW = new Date(2026, 6, 15, 21, 30, 12, 345);

const baseProps: ComponentProps<typeof StepWhen> = {
    date: NOW,
    now: NOW,
    onPick: jest.fn(),
    onSelect: jest.fn(),
};

const optionNames = () => screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);

describe("stepWhen", () => {
    it("offers the two quick days and the picker, and marks today", async () => {
        await render(<StepWhen {...baseProps} />);

        expect(optionNames()).toStrictEqual([
            "transaction.sentence.when.today",
            "transaction.sentence.when.yesterday",
            "transaction.field.date",
        ]);
        expect(
            screen.getByRole("button", { name: "transaction.sentence.when.today" }).props.accessibilityState.selected
        ).toBe(true);
    });

    // The entry's clock time is stored with it, and naming a day is not a reason
    // to reset it.
    it("keeps the time of day when the day changes", async () => {
        const onSelect = jest.fn<(date: Date) => void>();
        await render(<StepWhen {...baseProps} onSelect={onSelect} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.sentence.when.yesterday" }));

        const picked = onSelect.mock.calls[0]?.[0] as Date;
        expect(picked.getDate()).toBe(14);
        expect([picked.getHours(), picked.getMinutes(), picked.getSeconds()]).toStrictEqual([21, 30, 12]);
    });

    it("states a date the quick options cannot, as the selection", async () => {
        await render(<StepWhen {...baseProps} date={new Date(2026, 6, 10, 9, 5)} />);

        expect(optionNames()).toStrictEqual([
            "transaction.sentence.when.today",
            "transaction.sentence.when.yesterday",
            "10 Jul",
            "transaction.field.date",
        ]);
        expect(screen.getByRole("button", { name: "10 Jul" }).props.accessibilityState.selected).toBe(true);
        expect(
            screen.getByRole("button", { name: "transaction.sentence.when.today" }).props.accessibilityState.selected
        ).toBe(false);
    });

    it("delegates the calendar to the host", async () => {
        const onPick = jest.fn();
        await render(<StepWhen {...baseProps} onPick={onPick} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.field.date" }));

        expect(onPick).toHaveBeenCalledTimes(1);
    });

    it("labels the picker with the host's word where it has one", async () => {
        await render(<StepWhen {...baseProps} pickLabel="Pick a date" />);

        expect(screen.getByRole("button", { name: "Pick a date" })).toBeTruthy();
    });
});
