import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { Sentence } from "./sentence";
import { SentenceBlank } from "./sentence-blank";

jest.mock("@/components/thinking-orb/thinking-orb", () => ({ ThinkingOrb: () => null }));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

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

const renderPart = async (part: ReactNode) => {
    const { toJSON } = await render(<Sentence slots={{ slot: part }} template="{slot}" />);
    return toJSON() as JsonNode;
};

describe("the slot the stage is editing", () => {
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
