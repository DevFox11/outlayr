import { opacity } from "@expo/ui/swift-ui/modifiers";
import { render } from "@testing-library/react-native";
import { CategoryEditorCta } from "./cta";

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

function findButtonModifiers(node: JsonNode | JsonNode[] | null): { $type: string }[] | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findButtonModifiers(child);
			if (found) {
				return found;
			}
		}
		return null;
	}
	const modifiers = node.props?.modifiers as { $type: string }[] | undefined;
	if (Array.isArray(modifiers) && modifiers.some((m) => m.$type === "buttonStyle")) {
		return modifiers;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findButtonModifiers(child);
		if (found) {
			return found;
		}
	}
	return null;
}

describe("CategoryEditorCta", () => {
	it("renders the label text passed in", async () => {
		const { toJSON } = await render(
			<CategoryEditorCta canSave label="Add Category" onPress={() => {}} tintColor="#000000" underPicker={[]} />
		);
		const label = findByProp(toJSON() as JsonNode, "text", "Add Category");
		expect(label).not.toBeNull();
	});

	it("carries the tint color into its modifiers", async () => {
		const { toJSON } = await render(
			<CategoryEditorCta canSave label="Save Category" onPress={() => {}} tintColor="#222222" underPicker={[]} />
		);
		expect(JSON.stringify(toJSON())).toContain('"$type":"tint","color":"#222222"');
	});

	it("disables the button when canSave is false", async () => {
		const { toJSON } = await render(
			<CategoryEditorCta canSave={false} label="Add Category" onPress={() => {}} tintColor="#000000" underPicker={[]} />
		);
		expect(JSON.stringify(toJSON())).toContain('"$type":"disabled","disabled":true');
	});

	it("enables the button when canSave is true", async () => {
		const { toJSON } = await render(
			<CategoryEditorCta canSave label="Add Category" onPress={() => {}} tintColor="#000000" underPicker={[]} />
		);
		expect(JSON.stringify(toJSON())).toContain('"$type":"disabled","disabled":false');
	});

	it("appends the caller's underPicker modifiers after its own", async () => {
		const { toJSON } = await render(
			<CategoryEditorCta
				canSave
				label="Add Category"
				onPress={() => {}}
				tintColor="#000000"
				underPicker={[opacity(0.5)]}
			/>
		);
		const modifiers = findButtonModifiers(toJSON() as JsonNode);
		expect(modifiers?.map((m) => m.$type)).toEqual(["buttonStyle", "controlSize", "tint", "disabled", "opacity"]);
	});
});
