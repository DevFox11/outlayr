import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";

import { SearchEmptyState } from "./search-empty-state";

jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));

jest.mock("@/theme/use-colors", () => ({
    useColors: () => ({ background: "#F2F0EA", foreground: "#17150F" }),
}));

interface TreeNode {
    children?: (TreeNode | string)[] | null;
    props?: { style?: unknown };
}

function strokedRects(node: TreeNode | string | null): ViewStyle[] {
    if (!node || typeof node === "string") {
        return [];
    }
    const style = StyleSheet.flatten(node.props?.style) as ViewStyle | undefined;
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
