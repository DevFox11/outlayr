import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { TransactionFormRateSection } from "./rate-section";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () =>
        mockTestColors({
            border: "#DAD6C9",
            danger: "#B5482F",
            foreground: "#17150F",
            income: "#3D7A5C",
            muted: "#8A8578",
            surface: "#FFFFFF",
            surfaceSecondary: "#F7F5EF",
        }),
}));

const labels = {
    conversion: null,
    custom: "Custom",
    editCustom: "Edit custom rate",
    eurReference: "EUR reference",
    official: "Official",
    pendingBody: "Native amount remains recorded. Cross-currency totals wait for confirmation.",
    pendingTitle: "Rate confirmation needed",
    perUsd: "VES per USD",
    required: "Enter a positive rate",
    requiredHint: "The rate must be greater than zero.",
    set: "Set",
    title: "Entry rate",
};

const baseProps: ComponentProps<typeof TransactionFormRateSection> = {
    contentWidth: 353,
    currency: "VES",
    error: null,
    labels,
    onEditCustom: jest.fn(),
    onSelectType: jest.fn(),
    onUseSuggestion: jest.fn(),
    pending: false,
    selection: { exchangeRate: null, exchangeRateType: "official" },
    suggestions: {
        eurReference: 50,
        official: 42,
        priorCustom: { date: new Date("2026-08-01T12:00:00.000Z"), rate: 55.5 },
    },
};

describe("transactionFormRateSection", () => {
    it("renders no rate controls for USD", async () => {
        const { queryByText } = await render(<TransactionFormRateSection {...baseProps} currency="USD" />);

        expect(queryByText("Entry rate · Official")).toBeNull();
    });

    it("offers Official and Custom for EUR and also EUR reference for VES", async () => {
        const withoutSuggestions = { eurReference: null, official: null, priorCustom: null };
        const eur = await render(
            <TransactionFormRateSection {...baseProps} currency="EUR" suggestions={withoutSuggestions} />
        );
        expect(eur.getByText("Entry rate · Official")).toBeTruthy();
        expect(eur.getByText("Custom")).toBeTruthy();
        expect(eur.queryByText("EUR reference")).toBeNull();

        const ves = await render(<TransactionFormRateSection {...baseProps} suggestions={withoutSuggestions} />);
        expect(ves.getByText("EUR reference")).toBeTruthy();
    });

    it("announces that a pending recurring custom occurrence needs confirmation", async () => {
        const { getByText } = await render(<TransactionFormRateSection {...baseProps} pending />);

        expect(getByText("Rate confirmation needed")).toBeTruthy();
        expect(getByText(labels.pendingBody).props.accessibilityLiveRegion).toBe("polite");
    });

    it("promotes the selected policy to the head and leaves only the others tappable", async () => {
        const { getByText, getByRole, queryByRole } = await render(<TransactionFormRateSection {...baseProps} />);

        expect(getByText("Entry rate · Official")).toBeTruthy();
        expect(queryByRole("button", { name: "Official" })).toBeNull();
        expect(getByRole("button", { name: "EUR reference" }).props.accessibilityValue).toMatchObject({
            text: "50 VES per USD",
        });
        expect(getByRole("button", { name: "Custom" }).props.accessibilityValue).toMatchObject({
            text: "55.5 VES per USD",
        });
    });

    it("gives the head and every alternate at least a 44-point touch target", async () => {
        const { getByRole, getByLabelText } = await render(
            <TransactionFormRateSection {...baseProps} selection={{ exchangeRate: 55.5, exchangeRateType: "custom" }} />
        );
        const controls = [
            getByLabelText("Entry rate · Custom"),
            getByRole("button", { name: "Official" }),
            getByRole("button", { name: "EUR reference" }),
        ];

        for (const control of controls) {
            expect(StyleSheet.flatten(control.props.style)?.minHeight).toBeGreaterThanOrEqual(44);
        }
    });

    it("shows the selected rate as the head figure and the alternates beneath, selecting none of them", async () => {
        const onUseSuggestion = jest.fn();
        const { getByText } = await render(
            <TransactionFormRateSection {...baseProps} onUseSuggestion={onUseSuggestion} />
        );

        expect(getByText("42")).toBeTruthy();
        expect(getByText("50")).toBeTruthy();
        expect(getByText("55.5")).toBeTruthy();
        expect(onUseSuggestion).not.toHaveBeenCalled();
    });

    it("falls back to the official suggestion when the policy is selected but no rate was applied", async () => {
        const { getByLabelText } = await render(<TransactionFormRateSection {...baseProps} />);

        expect(getByLabelText("Entry rate · Official").props.accessibilityValue).toMatchObject({
            text: "42 VES per USD",
        });
    });

    it("applies the exact displayed rate only after a user press", async () => {
        const onUseSuggestion = jest.fn();
        const { getByRole } = await render(
            <TransactionFormRateSection {...baseProps} onUseSuggestion={onUseSuggestion} />
        );

        expect(onUseSuggestion).not.toHaveBeenCalled();
        await fireEvent.press(getByRole("button", { name: "Custom" }));
        expect(onUseSuggestion).toHaveBeenCalledWith(55.5, "custom");
    });

    it("opens the pad instead of applying a rate when custom has no prior value", async () => {
        const onSelectType = jest.fn();
        const onUseSuggestion = jest.fn();
        const { getByRole } = await render(
            <TransactionFormRateSection
                {...baseProps}
                onSelectType={onSelectType}
                onUseSuggestion={onUseSuggestion}
                suggestions={{ ...baseProps.suggestions, priorCustom: null }}
            />
        );

        await fireEvent.press(getByRole("button", { name: "Custom" }));
        expect(onSelectType).toHaveBeenCalledWith("custom");
        expect(onUseSuggestion).not.toHaveBeenCalled();
    });

    it("names equal-valued rates by their visible policy so assistive technology can distinguish them", async () => {
        const { getByLabelText, getByRole } = await render(
            <TransactionFormRateSection {...baseProps} suggestions={{ ...baseProps.suggestions, official: 55.5 }} />
        );

        expect(getByLabelText("Entry rate · Official").props.accessibilityValue).toMatchObject({
            text: "55.5 VES per USD",
        });
        expect(getByRole("button", { name: "Custom" }).props.accessibilityValue).toMatchObject({
            text: "55.5 VES per USD",
        });
    });

    it("renders the conversion line only when the form supplies one", async () => {
        const silent = await render(<TransactionFormRateSection {...baseProps} />);
        expect(silent.queryByText("That is $1.32")).toBeNull();

        const loud = await render(
            <TransactionFormRateSection {...baseProps} labels={{ ...labels, conversion: "That is $1.32" }} />
        );
        expect(loud.getByText("That is $1.32")).toBeTruthy();
    });

    it("renders the positive-rate validation message beside the custom affordance", async () => {
        const { getByText, getByRole } = await render(
            <TransactionFormRateSection
                {...baseProps}
                error="Enter a positive rate"
                selection={{ exchangeRate: null, exchangeRateType: "custom" }}
                suggestions={{ ...baseProps.suggestions, priorCustom: null }}
            />
        );

        expect(getByText("Enter a positive rate")).toBeTruthy();
        expect(getByText("The rate must be greater than zero.")).toBeTruthy();
        expect(getByRole("button", { name: "Edit custom rate" })).toBeTruthy();
    });
});
