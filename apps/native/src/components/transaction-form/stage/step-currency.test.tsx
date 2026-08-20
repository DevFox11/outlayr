import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepCurrency } from "./step-currency";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));

// The list is shipped code with its own suite; what this component owns is the
// search field feeding it and the selection passing through.
jest.mock<Partial<typeof import("../../currency-picker-list")>>("../../currency-picker-list", () => {
    const { createElement } = require("react");
    const { Text, Pressable } = require("react-native");
    return {
        CurrencyPickerList: ({
            favourites,
            onSelect,
            query,
            selected,
        }: {
            favourites: readonly string[];
            onSelect: (code: string) => void;
            query: string;
            selected: string;
        }) =>
            createElement(Pressable, { onPress: () => onSelect("VES"), testID: "list" }, [
                createElement(Text, { key: "query" }, `query:${query}`),
                createElement(Text, { key: "selected" }, `selected:${selected}`),
                createElement(Text, { key: "favourites" }, `favourites:${favourites.join(",")}`),
            ]),
    };
});

const baseProps: ComponentProps<typeof StepCurrency> = {
    favourites: ["USD", "VES"],
    listMinHeight: 320,
    onSelect: jest.fn(),
    onToggleFavourite: jest.fn(),
    searchPlaceholder: "Search currencies",
    selected: "USD",
};

describe("stepCurrency", () => {
    it("clusters the suggested codes and marks the selected one", async () => {
        const { getByText } = await render(<StepCurrency {...baseProps} />);

        expect(getByText("favourites:USD,VES")).toBeTruthy();
        expect(getByText("selected:USD")).toBeTruthy();
    });

    it("threads what is typed into the list's search", async () => {
        const { findByText, getByLabelText } = await render(<StepCurrency {...baseProps} />);

        fireEvent.changeText(getByLabelText("Search currencies"), "eur");

        await expect(findByText("query:eur")).resolves.toBeTruthy();
    });

    it("reports the picked code", async () => {
        const onSelect = jest.fn();
        const { getByTestId } = await render(<StepCurrency {...baseProps} onSelect={onSelect} />);

        fireEvent.press(getByTestId("list"));

        expect(onSelect).toHaveBeenCalledWith("VES");
    });
});
