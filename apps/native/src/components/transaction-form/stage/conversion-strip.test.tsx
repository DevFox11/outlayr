import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { ConversionStrip } from "./conversion-strip";

const labels = {
    notConverted: "Not converted",
    pendingBody: "The native amount remains recorded. Cross-currency totals wait for your confirmation.",
    setRate: "Set a rate",
};

const baseProps: ComponentProps<typeof ConversionStrip> = {
    amount: 420,
    amountUsd: 10,
    currency: "VES",
    labels,
    language: "en",
    onPress: jest.fn(),
    rate: { source: "Official", value: 42 },
};

describe("conversionStrip", () => {
    it("is absent for USD, which has no rate to state", async () => {
        const { toJSON } = await render(<ConversionStrip {...baseProps} amountUsd={420} currency="USD" rate={null} />);

        expect(toJSON()).toBeNull();
    });

    it("reads as the native amount equalling its USD value, sourced and rated", async () => {
        const { getByText, queryByRole } = await render(<ConversionStrip {...baseProps} />);

        expect(getByText("Bs.420.00 = $10.00")).toBeTruthy();
        expect(getByText("Official · 42")).toBeTruthy();
        // A settled conversion carries no hint: there is nothing outstanding.
        expect(queryByRole("button")?.props.accessibilityHint).toBeUndefined();
    });

    it("formats through the locale-aware formatter", async () => {
        const { getByText } = await render(<ConversionStrip {...baseProps} language="es" />);

        expect(getByText("420,00\u00A0Bs. = 10,00\u00A0$")).toBeTruthy();
    });

    it("warns without a rate, and says the entry is recorded regardless", async () => {
        const { getByRole, getByText } = await render(<ConversionStrip {...baseProps} amountUsd={null} rate={null} />);

        expect(getByText("Not converted")).toBeTruthy();
        expect(getByText("Set a rate")).toBeTruthy();
        expect(getByText(labels.pendingBody)).toBeTruthy();
        // The Pressable collapses MetaLine's own alert role, so the pending
        // sentence has to reach assistive technology as the button's hint.
        expect(getByRole("button").props.accessibilityHint).toBe(labels.pendingBody);
    });

    it("opens the rate step when tapped", async () => {
        const onPress = jest.fn();
        const { getByRole } = await render(<ConversionStrip {...baseProps} onPress={onPress} />);

        fireEvent.press(getByRole("button"));

        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
