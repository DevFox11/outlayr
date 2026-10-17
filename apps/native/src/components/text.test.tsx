import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { FontScaleCapContext, Text } from "./text";

describe("text", () => {
    it("stops scaling at the cap its surroundings set, unless the caller sets its own", async () => {
        const { getByText } = await render(
            <FontScaleCapContext value={1.35}>
                <Text>capped</Text>
                <Text maxFontSizeMultiplier={2}>own</Text>
            </FontScaleCapContext>
        );

        expect(getByText("capped").props.maxFontSizeMultiplier).toBe(1.35);
        expect(getByText("own").props.maxFontSizeMultiplier).toBe(2);
    });
});
