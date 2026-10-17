import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepMerchant } from "./step-merchant";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578", separator: "#DAD6C9", tint: "#3D7A5C" }),
}));

const baseProps: ComponentProps<typeof StepMerchant> = {
    accessibilityLabel: "Merchant name",
    onChange: jest.fn(),
    placeholder: "Netflix, Groceries…",
    recent: [],
    recentLabel: "Recently",
    suggestions: [],
    value: "",
};

const labelsIn = (testID: string) =>
    within(screen.getByTestId(testID))
        .getAllByRole("button")
        .map((node) => String(node.props.accessibilityLabel));

describe("stepMerchant", () => {
    it("offers what was typed against, and what was filed before", async () => {
        await render(<StepMerchant {...baseProps} recent={["Panaderia"]} suggestions={["Netflix"]} value="net" />);

        expect(labelsIn("stage-merchant-suggestions")).toStrictEqual(["Netflix"]);
        expect(labelsIn("stage-merchant-recent")).toStrictEqual(["Panaderia"]);
        expect(screen.getByText("Recently")).toBeTruthy();
    });

    it("hands back the whole name a row was pressed for", async () => {
        const onChange = jest.fn();
        await render(<StepMerchant {...baseProps} onChange={onChange} recent={["Rio Supermercado"]} value="rio" />);

        fireEvent.press(screen.getByRole("button", { name: "Rio Supermercado" }));

        expect(onChange).toHaveBeenCalledWith("Rio Supermercado");
    });

    it("marks the row the name already came from", async () => {
        await render(<StepMerchant {...baseProps} recent={["Netflix", "Panaderia"]} value="Netflix" />);

        expect(screen.getByRole("button", { name: "Netflix" }).props.accessibilityState.selected).toBe(true);
        expect(screen.getByRole("button", { name: "Panaderia" }).props.accessibilityState.selected).toBe(false);
    });
});
