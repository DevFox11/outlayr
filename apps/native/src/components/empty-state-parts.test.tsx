import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";

import { GhostPanel, Tile } from "./empty-state-parts";

jest.mock("@/theme/use-colors", () => ({
    useColors: () => ({ foreground: "#000000" }),
}));

async function rootStyle(ui: ReactElement): Promise<ViewStyle> {
    const tree = (await render(ui)).toJSON();
    if (!tree || Array.isArray(tree)) {
        throw new Error("expected a single root node");
    }
    return StyleSheet.flatten(tree.props.style) as ViewStyle;
}

describe("mark corners", () => {
    it("draws GhostPanel with a continuous corner curve", async () => {
        const style = await rootStyle(<GhostPanel width={200} />);
        expect(style.borderCurve).toBe("continuous");
    });

    it("draws Tile with a continuous corner curve", async () => {
        const style = await rootStyle(<Tile size={40} />);
        expect(style.borderCurve).toBe("continuous");
    });

    it("keeps the continuous curve when a caller overrides GhostPanel's radius", async () => {
        const style = await rootStyle(<GhostPanel style={{ borderRadius: 18 }} width={200} />);
        expect(style.borderRadius).toBe(18);
        expect(style.borderCurve).toBe("continuous");
    });
});
