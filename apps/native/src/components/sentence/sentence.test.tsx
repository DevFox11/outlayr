import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { Text } from "../text";
import { Sentence } from "./sentence";

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

const words = (node: JsonNode | string | null): string[] => {
    if (node === null) {
        return [];
    }
    if (typeof node === "string") {
        return [node];
    }
    return (node.children ?? []).flatMap(words);
};

const renderSentence = async (template: string) => {
    const { toJSON } = await render(
        <Sentence
            slots={{
                account: <Text>Chase</Text>,
                amount: <Text>$12</Text>,
                merchant: <Text>Netflix</Text>,
            }}
            template={template}
        />
    );
    return words(toJSON() as JsonNode);
};

describe("sentence", () => {
    // The whole reason the template drives layout rather than the tree: the JSX
    // below is in a fixed order and English is not the order it is written in.
    it("places each slot where the template puts it, not where the child sits", async () => {
        await expect(renderSentence("{amount} at {merchant} from {account}")).resolves.toStrictEqual([
            "$12",
            "at",
            "Netflix",
            "from",
            "Chase",
        ]);
    });

    it("keeps punctuation against the value it closes", async () => {
        await expect(renderSentence("at {merchant}.")).resolves.toStrictEqual(["at", "Netflix", "."]);
    });

    it("drops a slot the template never references", async () => {
        await expect(renderSentence("{amount}")).resolves.toStrictEqual(["$12"]);
    });

    it("renders a template slot with no child as nothing", async () => {
        await expect(renderSentence("{amount} {unfilled}")).resolves.toStrictEqual(["$12"]);
    });
});
