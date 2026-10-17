import { describe, expect, it, jest } from "@jest/globals";
import { RECURRING_TYPE } from "@outlayr/money/recurrence";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepRepeat } from "./step-repeat";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const baseProps: ComponentProps<typeof StepRepeat> = {
    cadence: RECURRING_TYPE.monthly,
    endDate: null,
    labels: { ending: "ending", endingOpen: "ending", openEnd: "never", starting: "starting" },
    leadDays: null,
    onCadenceChange: jest.fn(),
    onCustomPress: jest.fn(),
    onEndDatePress: jest.fn(),
    onLeadChange: jest.fn(),
    onStartDatePress: jest.fn(),
    startDate: new Date(2026, 6, 15),
};

const isSelected = (name: string) => screen.getByRole("button", { name }).props.accessibilityState.selected;

describe("stepRepeat", () => {
    it("marks the stored cadence and the off lead", async () => {
        await render(<StepRepeat {...baseProps} />);

        expect(isSelected("transaction.cadence.monthly")).toBe(true);
        expect(isSelected("transaction.schedule.customOption")).toBe(false);
        expect(isSelected("transaction.remind.off")).toBe(true);
    });

    // A custom interval is still stored against one of the four types, so the
    // plain cadence has to let go of the selection or two pills read as chosen.
    it("hands the selection to custom while the host's interval is in force", async () => {
        await render(<StepRepeat {...baseProps} custom />);

        expect(isSelected("transaction.schedule.customOption")).toBe(true);
        expect(isSelected("transaction.cadence.monthly")).toBe(false);
    });

    it("names the host's interval in place of the plain custom word", async () => {
        await render(<StepRepeat {...baseProps} custom customLabel="every 3 weeks" />);

        expect(isSelected("every 3 weeks")).toBe(true);
    });

    it("reports a picked cadence", async () => {
        const onCadenceChange = jest.fn();
        await render(<StepRepeat {...baseProps} onCadenceChange={onCadenceChange} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.cadence.weekly" }));

        expect(onCadenceChange).toHaveBeenCalledWith(RECURRING_TYPE.weekly);
    });

    it("reads an open end with its own connector", async () => {
        await render(
            <StepRepeat
                {...baseProps}
                labels={{ ending: "hasta el", endingOpen: "sin", openEnd: "fecha de fin", starting: "desde el" }}
            />
        );

        expect(screen.getByTestId("stage-repeat-line")).toHaveTextContent("desde el 15 Jul, sin fecha de fin.");
    });

    it("states the end date once there is one", async () => {
        await render(<StepRepeat {...baseProps} endDate={new Date(2026, 11, 1)} />);

        expect(screen.getByRole("button", { name: "1 Dec" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "never" })).toBeNull();
    });

    it("reports a picked lead", async () => {
        const onLeadChange = jest.fn();
        await render(<StepRepeat {...baseProps} onLeadChange={onLeadChange} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.remind.sameDay" }));

        expect(onLeadChange).toHaveBeenCalledWith(0);
    });

    it("clears the lead back to off", async () => {
        const onLeadChange = jest.fn();
        await render(<StepRepeat {...baseProps} leadDays={7} onLeadChange={onLeadChange} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.remind.off" }));

        expect(onLeadChange).toHaveBeenCalledWith(null);
    });

    // A lead this row never offered — three days, or one restored from another
    // device — stays visible, or the row reads as having nothing chosen.
    it("appends a lead it does not offer rather than dropping it", async () => {
        await render(<StepRepeat {...baseProps} leadDays={3} />);

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(13);
        expect(buttons.at(-1)?.props.accessibilityState.selected).toBe(true);
        expect(isSelected("transaction.remind.off")).toBe(false);
    });
});
