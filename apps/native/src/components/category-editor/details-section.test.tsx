import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { CategoryEditorDetailsSection } from "./details-section";

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

const FAKE_NAME_STATE = {
    get: () => "",
    onChange: null,
    set: () => {},
    value: "",
} as unknown as Parameters<typeof CategoryEditorDetailsSection>[0]["nameState"];

const BASE_PROPS = {
    caption: null,
    dangerColor: "#C01005",
    expenseLabel: "Expense",
    failure: null,
    income: false,
    incomeLabel: "Income",
    nameFieldRef: { current: null },
    nameLabel: "Name",
    namePlaceholder: "Category name",
    nameState: FAKE_NAME_STATE,
    onIncomeChange: () => {},
    onNameChange: () => {},
    onSubmitName: () => {},
    tintColor: "#123456",
    typeLabel: "Type",
    typePickerVisible: true,
} satisfies Parameters<typeof CategoryEditorDetailsSection>[0];

describe("categoryEditorDetailsSection", () => {
    it("renders the name label passed in", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} />);
        expect(findByProp(toJSON() as JsonNode, "text", "Name")).not.toBeNull();
    });

    it("passes the placeholder through to the name field", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} />);
        expect(findByProp(toJSON() as JsonNode, "placeholder", "Category name")).not.toBeNull();
    });

    it("hides the type row when typePickerVisible is false", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} typePickerVisible={false} />);
        expect(findByProp(toJSON() as JsonNode, "text", "Type")).toBeNull();
        expect(findByProp(toJSON() as JsonNode, "text", "Expense")).toBeNull();
    });

    it("shows the expense/income options when typePickerVisible is true", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} />);
        const json = toJSON() as JsonNode;
        expect(findByProp(json, "text", "Type")).not.toBeNull();
        expect(findByProp(json, "text", "Expense")).not.toBeNull();
        expect(findByProp(json, "text", "Income")).not.toBeNull();
    });

    it("carries the tint color into the picker's modifiers", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} tintColor="#ABCDEF" />);
        expect(JSON.stringify(toJSON())).toContain('"$type":"tint","color":"#ABCDEF"');
    });

    it("renders the caption as the section footer when present", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} caption="Inherits from Bills" />);
        expect(findByProp(toJSON() as JsonNode, "text", "Inherits from Bills")).not.toBeNull();
    });

    it("omits the footer when caption is null", async () => {
        const { toJSON } = await render(<CategoryEditorDetailsSection {...BASE_PROPS} caption={null} />);
        expect(findByProp(toJSON() as JsonNode, "text", "Inherits from Bills")).toBeNull();
    });

    it("shows a failure in the footer in place of the caption", async () => {
        const { toJSON } = await render(
            <CategoryEditorDetailsSection {...BASE_PROPS} caption="Inherits from Bills" failure="That name is taken." />
        );
        const json = toJSON() as JsonNode;
        expect(findByProp(json, "text", "That name is taken.")).not.toBeNull();
        expect(findByProp(json, "text", "Inherits from Bills")).toBeNull();
    });

    it("tints the failure footer with the danger color", async () => {
        const { toJSON } = await render(
            <CategoryEditorDetailsSection {...BASE_PROPS} dangerColor="#ABCDEF" failure="That name is taken." />
        );
        expect(JSON.stringify(toJSON())).toContain('"#ABCDEF"');
    });
});
