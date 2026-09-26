import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { StepRate, StepRateField } from "./step-rate";
import type { StepRateOption } from "./step-rate";

const options: StepRateOption[] = [
    {
        detail: "As of 26 Sep",
        figure: "848.55",
        name: "Official",
        placeholder: "Unavailable",
        type: "official",
        unit: "Bs. per $",
    },
    {
        detail: "As of 26 Sep",
        figure: null,
        name: "EUR reference",
        placeholder: "Unavailable",
        type: "eur_reference",
        unit: "Bs. per €",
    },
    {
        detail: "Type the rate you got",
        figure: null,
        name: "My rate",
        placeholder: "Type",
        type: "custom",
        unit: "Bs. per $",
    },
];

describe("stepRate", () => {
    it("checks only the selected option and states each figure with its unit", async () => {
        const { getByRole } = await render(<StepRate onSelect={jest.fn()} options={options} selected="official" />);

        const official = getByRole("radio", { name: "Official" });
        expect(official.props.accessibilityState).toMatchObject({ checked: true });
        expect(official.props.accessibilityValue).toMatchObject({ text: "848.55 Bs. per $" });
        expect(getByRole("radio", { name: "My rate" }).props.accessibilityState).toMatchObject({ checked: false });
    });

    it("still lets a provider with no rate be chosen, so a blank custom rate is never a dead end", async () => {
        const onSelect = jest.fn();
        const { getByRole } = await render(<StepRate onSelect={onSelect} options={options} selected="custom" />);

        await fireEvent.press(getByRole("radio", { name: "EUR reference" }));

        expect(onSelect).toHaveBeenCalledWith("eur_reference");
    });
});

describe("stepRateField", () => {
    it("shows the typed rate, its unit and how it compares, with no error until one is given", async () => {
        const { getByText, queryByText, rerender } = await render(
            <StepRateField error={null} note="0.2% above official" placeholder={false} unit="Bs. per $" value="850">
                <Text>keys</Text>
            </StepRateField>
        );

        expect(getByText("850")).toBeTruthy();
        expect(getByText("Bs. per $")).toBeTruthy();
        expect(getByText("0.2% above official")).toBeTruthy();
        expect(queryByText("Type a rate first")).toBeNull();

        await rerender(
            <StepRateField error="Type a rate first" note={null} placeholder unit="Bs. per $" value="Type">
                <Text>keys</Text>
            </StepRateField>
        );
        expect(getByText("Type a rate first")).toBeTruthy();
    });

    it("applies a reference rate when it is pressed", async () => {
        const onPress = jest.fn();
        const { getByRole } = await render(
            <StepRateField
                error={null}
                note={null}
                placeholder
                references={[{ figure: "848.55", label: "Official", onPress }]}
                value="Type"
            >
                <Text>keys</Text>
            </StepRateField>
        );

        await fireEvent.press(getByRole("button", { name: "Official" }));

        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
