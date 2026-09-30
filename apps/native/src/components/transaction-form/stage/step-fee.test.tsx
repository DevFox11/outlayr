import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepFee } from "./step-fee";
import type { StepFeeField } from "./step-fee";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const OPTIONS = [
    { id: "none", label: "None" },
    { id: "percent", label: "Percent" },
] as const;

const FIELD: StepFeeField = {
    comesTo: { amount: "$0.88", template: "a {amount} fee" },
    label: "Card fee",
    placeholder: false,
    unit: "%",
    value: "3.5",
};

const step = (field: StepFeeField | null, onLoggedAsPress = jest.fn()) => (
    <StepFee
        field={field}
        labels={{ loggedAs: "Logged as", total: "Chase pays" }}
        loggedAs="Utilities"
        onLoggedAsPress={onLoggedAsPress}
        onSelect={jest.fn()}
        options={OPTIONS}
        selectedId="percent"
        total="$25.88"
    >
        <Text testID="keys">keys</Text>
    </StepFee>
);

describe("stepFee", () => {
    it("states the typed figure, its unit and what it comes to directly above the keys", async () => {
        const screen = await render(step(null));
        expect(screen.queryByTestId("stage-fee-field")).toBeNull();

        await screen.rerender(step(FIELD));

        const field = screen.getByTestId("stage-fee-field");
        expect(field.props.accessibilityLabel).toBe("Card fee");
        expect(field.props.accessibilityValue).toStrictEqual({ text: "3.5 %, a $0.88 fee" });
        expect(field).toHaveTextContent("3.5%a$0.88fee");
        const json = JSON.stringify(screen.toJSON());
        expect(json.indexOf("stage-fee-field")).toBeLessThan(json.indexOf('"keys"'));
    });

    it("opens the fee's category from Logged as and names who pays the total", async () => {
        const onLoggedAsPress = jest.fn();
        const screen = await render(step(null, onLoggedAsPress));

        await fireEvent.press(screen.getByRole("button", { name: "Logged as, Utilities" }));

        expect(onLoggedAsPress).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Chase pays")).toBeTruthy();
        expect(screen.getByText("$25.88")).toBeTruthy();
    });
});
