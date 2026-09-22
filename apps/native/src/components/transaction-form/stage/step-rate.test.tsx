import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text } from "react-native";

import { StepRate } from "./step-rate";

const labels = {
    custom: "Custom",
    editCustom: "Edit custom rate",
    error: {
        customRateRequired: "Enter a positive rate",
        eurReferenceRequiresVes: "EUR reference is only available for VES",
    },
    eurReference: "EUR reference",
    eurReferenceUnit: "VES per EUR",
    official: "Official",
    requiredHint: "Enter how many VES make 1 USD.",
    set: "Set",
    title: "Entry rate",
    unavailable: "Unavailable",
    unit: "VES per USD",
};

const baseProps: ComponentProps<typeof StepRate> = {
    currency: "VES",
    labels,
    onEditCustom: jest.fn(),
    onSelectType: jest.fn(),
    onUseSuggestion: jest.fn(),
    resolvedOn: "18 Aug",
    selection: { exchangeRate: null, exchangeRateType: "official" },
    suggestions: {
        eurOfficial: 0.8,
        eurReference: 50,
        official: 42,
        priorCustom: { date: new Date("2026-08-01T12:00:00.000Z"), rate: 55.5 },
    },
};

describe("stepRate", () => {
    it("has no rate UI at all for USD", async () => {
        const { toJSON } = await render(<StepRate {...baseProps} currency="USD" />);

        expect(toJSON()).toBeNull();
    });

    it("promotes the selected option with its unit, source and resolution date", async () => {
        const { getByText } = await render(<StepRate {...baseProps} />);

        expect(getByText("42")).toBeTruthy();
        expect(getByText("VES per USD")).toBeTruthy();
        expect(getByText("Official · 18 Aug")).toBeTruthy();
    });

    it("shows EUR the way a bank quotes it, in USD per EUR", async () => {
        const { getByText } = await render(
            <StepRate
                {...baseProps}
                currency="EUR"
                labels={{ ...labels, unit: "USD per EUR" }}
                suggestions={{ eurOfficial: null, eurReference: null, official: 0.87113, priorCustom: null }}
            />
        );

        expect(getByText("1.1479")).toBeTruthy();
    });

    it("states the EUR reference in VES per EUR, not per USD", async () => {
        const { getByLabelText, getByText } = await render(
            <StepRate {...baseProps} selection={{ exchangeRate: null, exchangeRateType: "eur_reference" }} />
        );

        expect(getByText("VES per EUR")).toBeTruthy();
        expect(getByLabelText("Official").props.accessibilityValue).toMatchObject({ text: "42 VES per USD" });
    });

    it("omits EUR reference for a non-VES currency rather than offering a dead option", async () => {
        const { getByText, queryByText } = await render(
            <StepRate {...baseProps} currency="COP" suggestions={{ ...baseProps.suggestions, eurReference: null }} />
        );

        expect(queryByText("EUR reference")).toBeNull();
        expect(getByText("Custom")).toBeTruthy();
    });

    it("says a rate outside the provider window is unavailable instead of showing a stale figure", async () => {
        const { getByText, queryByText } = await render(
            <StepRate
                {...baseProps}
                currency="COP"
                suggestions={{ eurOfficial: null, eurReference: null, official: null, priorCustom: null }}
            />
        );

        expect(getByText("Unavailable")).toBeTruthy();
        expect(queryByText("42")).toBeNull();
    });

    it("offers a custom rate as settable, and names the error inline", async () => {
        const { getByText } = await render(
            <StepRate
                {...baseProps}
                selection={{ exchangeRate: null, exchangeRateType: "custom" }}
                suggestions={{ eurOfficial: null, eurReference: null, official: null, priorCustom: null }}
            />
        );

        expect(getByText("Set")).toBeTruthy();
        expect(getByText("Enter a positive rate")).toBeTruthy();
    });

    it("renders the keypad only while custom is selected", async () => {
        const keypad = <Text>keypad</Text>;
        const { queryByText, rerender } = await render(<StepRate {...baseProps}>{keypad}</StepRate>);

        expect(queryByText("keypad")).toBeNull();

        await rerender(
            <StepRate {...baseProps} selection={{ exchangeRate: 55.5, exchangeRateType: "custom" }}>
                {keypad}
            </StepRate>
        );

        expect(queryByText("keypad")).toBeTruthy();
    });

    it("applies an alternate's rate when it is promoted", async () => {
        const onUseSuggestion = jest.fn();
        const { getByLabelText } = await render(<StepRate {...baseProps} onUseSuggestion={onUseSuggestion} />);

        fireEvent.press(getByLabelText("EUR reference"));

        expect(onUseSuggestion).toHaveBeenCalledWith(50, "eur_reference");
    });
});
