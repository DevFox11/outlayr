import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { SearchEmptyState } from "./search-empty-state";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ background: "#F2F0EA", foreground: "#17150F" }),
}));

interface TreeNode {
    children?: (TreeNode | string)[] | null;
    props?: { style?: StyleProp<ViewStyle> };
}

function strokedRects(node: TreeNode | string | null): ViewStyle[] {
    if (!node || typeof node === "string") {
        return [];
    }
    const style = StyleSheet.flatten(node.props?.style);
    const nested = (node.children ?? []).flatMap(strokedRects);
    return style?.borderWidth && style?.borderRadius ? [style, ...nested] : nested;
}

describe("search mark corners", () => {
    it("draws every stroked rounded rect with a continuous corner curve", async () => {
        const tree = (await render(<SearchEmptyState kind="idle" />)).toJSON();
        const rects = strokedRects(tree as TreeNode | null);

        expect(rects.length).toBeGreaterThan(0);
        for (const rect of rects) {
            expect(rect.borderCurve).toBe("continuous");
        }
    });
});
