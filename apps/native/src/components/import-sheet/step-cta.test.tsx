import { fireEvent, render } from "@testing-library/react-native";

import { StepCta } from "./step-cta";

describe("stepCta", () => {
    it("fires onPress on the first press when no confirm label is given", async () => {
        const onPress = jest.fn();
        const { getByText } = await render(<StepCta label="Continue" onPress={onPress} />);
        fireEvent.press(getByText("Continue"));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("arms on the first press and commits on the second when a confirm label is given", async () => {
        const onPress = jest.fn();
        const { findByText, getByText, queryByText } = await render(
            <StepCta confirmLabel="Import 3?" label="Import 3" onPress={onPress} />
        );

        fireEvent.press(getByText("Import 3"));
        expect(onPress).not.toHaveBeenCalled();
        expect(await findByText("Import 3?")).toBeTruthy();
        expect(queryByText("Import 3")).toBeNull();

        fireEvent.press(getByText("Import 3?"));
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(await findByText("Import 3")).toBeTruthy();
    });

    it("disarms when the confirm label changes underneath it", async () => {
        const onPress = jest.fn();
        const { findByText, getByText, rerender } = await render(
            <StepCta confirmLabel="Import 3?" label="Import 3" onPress={onPress} />
        );
        fireEvent.press(getByText("Import 3"));
        expect(await findByText("Import 3?")).toBeTruthy();

        await rerender(<StepCta confirmLabel="Import 2?" label="Import 2" onPress={onPress} />);
        expect(getByText("Import 2")).toBeTruthy();
    });

    it("ignores presses while disabled", async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(<StepCta disabled label="Continue" onPress={onPress} testID="cta" />);
        fireEvent.press(getByTestId("cta"));
        expect(onPress).not.toHaveBeenCalled();
    });

    it("keeps the label visible and ignores presses while busy", async () => {
        const onPress = jest.fn();
        const { getByTestId, getByText } = await render(
            <StepCta busy label="Continue" onPress={onPress} testID="cta" />
        );
        expect(getByText("Continue")).toBeTruthy();
        fireEvent.press(getByTestId("cta"));
        expect(onPress).not.toHaveBeenCalled();
    });
});
