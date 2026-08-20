import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { Sentence } from "./sentence";
import { SentenceBlank } from "./sentence-blank";
import { SentenceValue } from "./sentence-value";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

/** `--tint` at the wash's 13%, as `withAlpha` writes it from the light theme. */
const WASH = "rgba(194, 55, 27, 0.13)";

const nodes = (node: JsonNode | string | null): JsonNode[] => {
    if (node === null || typeof node === "string") {
        return [];
    }
    return [node, ...(node.children ?? []).flatMap(nodes)];
};

const classNames = (tree: JsonNode): string[] =>
    nodes(tree)
        .map((node) => node.props.className)
        .filter((name): name is string => typeof name === "string");

/** The wash's opacity, which is what its 180ms transition drives. */
const washOpacity = (tree: JsonNode): ViewStyle["opacity"] => {
    for (const node of nodes(tree)) {
        // SAFETY: RN types `flatten` against the whole style union; these are the
        // plain view styles this component writes.
        const style = StyleSheet.flatten(node.props.style as ViewStyle | undefined);
        if (style?.backgroundColor === WASH) {
            return style.opacity;
        }
    }
    return undefined;
};

const renderPart = async (part: ReactNode) => {
    const { toJSON } = await render(<Sentence slots={{ slot: part }} template="{slot}" />);
    return toJSON() as JsonNode;
};

describe("the slot the stage is editing", () => {
    it("washes a value and leaves the wash off every other one", async () => {
        const active = await renderPart(
            <SentenceValue accessibilityLabel="Category" active onPress={jest.fn()} value="Streaming" />
        );
        const idle = await renderPart(
            <SentenceValue accessibilityLabel="Category" onPress={jest.fn()} value="Streaming" />
        );

        expect(washOpacity(active)).toBe(1);
        expect(washOpacity(idle)).toBe(0);
    });

    it("washes a blank and turns its rule solid", async () => {
        const active = await renderPart(
            <SentenceBlank accessibilityLabel="Category" active label="a category" onPress={jest.fn()} />
        );

        expect(washOpacity(active)).toBe(1);
        expect(classNames(active).some((name) => name.includes("bg-tint"))).toBeTruthy();
        expect(classNames(active).some((name) => name.includes("border-dashed"))).toBeFalsy();
    });

    it("leaves an untouched blank dashed and unwashed", async () => {
        const idle = await renderPart(
            <SentenceBlank accessibilityLabel="Category" label="a category" onPress={jest.fn()} />
        );

        expect(washOpacity(idle)).toBe(0);
        expect(classNames(idle).some((name) => name.includes("border-blank-rule border-b-2 border-dashed"))).toBe(true);
    });

    // A blank that is both flagged and being edited is the ordinary case after a
    // rejected save: the stage opens on the slot that caused it.
    it("keeps a flagged blank red rather than washing over the refusal", async () => {
        const flagged = await renderPart(
            <SentenceBlank accessibilityLabel="Category" active flagged label="a category" onPress={jest.fn()} />
        );

        expect(classNames(flagged).some((name) => name.includes("bg-danger"))).toBeTruthy();
        expect(classNames(flagged).some((name) => name.includes("text-danger"))).toBeTruthy();
    });
});
