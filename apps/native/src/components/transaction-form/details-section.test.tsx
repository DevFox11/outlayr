import { background } from "@expo/ui/swift-ui/modifiers";
import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { TransactionFormDetailsSection } from "./details-section";
import { CARD_OUTLINE } from "./style";

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findByProp(node: JsonNode | JsonNode[] | null, key: string, value: unknown): JsonNode | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByProp(child, key, value);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (node.props?.[key] === value) {
        return node;
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            continue;
        }
        const found = findByProp(child, key, value);
        if (found) {
            return found;
        }
    }
    return null;
}

function findButtonWithText(
    node: JsonNode | JsonNode[] | null,
    text: string
): (JsonNode & { props: { onButtonPress: () => void } }) | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findButtonWithText(child, text);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (typeof node.props?.onButtonPress === "function" && findByProp(node, "text", text) !== null) {
        return node as JsonNode & { props: { onButtonPress: () => void } };
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            continue;
        }
        const found = findButtonWithText(child, text);
        if (found) {
            return found;
        }
    }
    return null;
}

const FAKE_NOTES = {
    get: () => "",
    onChange: null,
    set: () => {},
    value: "",
} as unknown as Parameters<typeof TransactionFormDetailsSection>[0]["notes"];

function renderSection(overrides: Partial<Parameters<typeof TransactionFormDetailsSection>[0]> = {}) {
    return render(
        <TransactionFormDetailsSection
            accountLabel="Account"
            accountName={null}
            accountNoneLabel="None"
            card={[]}
            foregroundColor="#123456"
            hairline={[]}
            mutedColor="#8A8578"
            notes={FAKE_NOTES}
            notesLabel="Notes"
            notesPlaceholder="Add a note"
            onAccountPress={() => {}}
            {...overrides}
        />
    );
}

describe("transactionFormDetailsSection", () => {
    it("renders the notes label passed in", async () => {
        const { toJSON } = await renderSection();
        expect(findByProp(toJSON() as JsonNode, "text", "Notes")).not.toBeNull();
    });

    it("passes the placeholder through to the text field", async () => {
        const { toJSON } = await renderSection();
        expect(findByProp(toJSON() as JsonNode, "placeholder", "Add a note")).not.toBeNull();
    });

    it("carries the foreground color into the text field's modifiers", async () => {
        const { toJSON } = await renderSection({ foregroundColor: "#ABCDEF" });
        expect(JSON.stringify(toJSON())).toContain('"$type":"foregroundStyle","styleType":"color","color":"#ABCDEF"');
    });

    it("applies the caller's card modifiers to the section root", async () => {
        const { toJSON } = await renderSection({
            card: [background("#FF00FF", CARD_OUTLINE)],
        });
        const tree = toJSON() as JsonNode;
        const modifiers = tree.props.modifiers as { $type: string }[];
        expect(modifiers.map((m) => m.$type)).toContain("background");
    });

    it("shows the none placeholder while no account is selected", async () => {
        const { toJSON } = await renderSection();
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "text", "Account")).not.toBeNull();
        expect(findByProp(tree, "text", "None")).not.toBeNull();
    });

    it("shows the selected account's name and tile", async () => {
        const { toJSON } = await renderSection({
            accountName: "Checking",
            accountTile: <Text>tile-marker</Text>,
        });
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "text", "Checking")).not.toBeNull();
        expect(findByProp(tree, "text", "None")).toBeNull();
        expect(JSON.stringify(tree)).toContain("tile-marker");
    });

    it("routes a press on the account row to onAccountPress", async () => {
        const onAccountPress = jest.fn();
        const { toJSON } = await renderSection({ onAccountPress });
        const button = findButtonWithText(toJSON() as JsonNode, "Account");
        expect(button).not.toBeNull();
        button?.props.onButtonPress();
        expect(onAccountPress).toHaveBeenCalledTimes(1);
    });
});
