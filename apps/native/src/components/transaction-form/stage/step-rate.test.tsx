import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { StepRate } from "./step-rate";
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
        name: "EUR (BCV)",
        placeholder: "Unavailable",
        type: "eur_reference",
        unit: "Bs. per $",
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
    it("checks only the selected option and states each figure with its unit and age", async () => {
        const { getByRole } = await render(<StepRate onSelect={jest.fn()} options={options} selected="official" />);

        const official = getByRole("radio", { name: "Official" });
        expect(official.props.accessibilityState).toMatchObject({ checked: true });
        expect(official.props.accessibilityValue).toMatchObject({ text: "848.55 Bs. per $, As of 26 Sep" });
        expect(getByRole("radio", { name: "My rate" }).props.accessibilityState).toMatchObject({ checked: false });
    });

    it("still lets a provider with no rate be chosen, so a blank custom rate is never a dead end", async () => {
        const onSelect = jest.fn();
        const { getByRole } = await render(<StepRate onSelect={onSelect} options={options} selected="custom" />);

        await fireEvent.press(getByRole("radio", { name: "EUR (BCV)" }));

        expect(onSelect).toHaveBeenCalledWith("eur_reference");
    });
});
