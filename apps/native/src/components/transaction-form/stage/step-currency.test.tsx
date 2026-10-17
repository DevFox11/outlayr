import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepCurrency } from "./step-currency";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));

// The list is shipped code with its own suite; what this component owns is the
// search field feeding it.
jest.mock<Partial<typeof import("../../currency-picker-list")>>("../../currency-picker-list", () => {
    const { createElement } = require("react");
    const { Text } = require("react-native");
    return {
        CurrencyPickerList: ({ query }: { query: string }) => createElement(Text, null, `query:${query}`),
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
    it("threads what is typed into the list's search", async () => {
        const { findByText, getByLabelText } = await render(<StepCurrency {...baseProps} />);

        fireEvent.changeText(getByLabelText("Search currencies"), "eur");

        await expect(findByText("query:eur")).resolves.toBeTruthy();
    });
});
