import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import type { ThemeColors } from "@/theme/use-colors";

import { Eyebrow } from "./category-list-chrome";

const colors = { muted: "#666666" } as ThemeColors;

describe("eyebrow", () => {
    it("renders through @expo/ui/swift-ui's Text with its label and modifiers", async () => {
        const { toJSON } = await render(<Eyebrow colors={colors}>THIS MONTH</Eyebrow>);

        const tree = toJSON();
        expect(tree?.type).toBe("ViewManagerAdapter_ExpoUI");
        expect(tree?.props.text).toBe("THIS MONTH");
        expect(tree?.props.modifiers).toStrictEqual(
            expect.arrayContaining([
                expect.objectContaining({ $type: "textCase", value: "uppercase" }),
                expect.objectContaining({
                    $type: "foregroundStyle",
                    style: { color: "#666666", type: "color" },
                }),
            ])
        );
    });
});
