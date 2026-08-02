import { render } from "@testing-library/react-native";
import { TransactionFormCta } from "./cta";

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findByProp(
	node: JsonNode | JsonNode[] | null,
	key: string,
	value: unknown,
): JsonNode | null {
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

describe("TransactionFormCta", () => {
	it("renders the label text passed in", async () => {
		const { toJSON } = await render(
			<TransactionFormCta
				canSave
				label="Add Transaction"
				labelColor="#FFFFFF"
				onPress={() => {}}
				tintColor="#000000"
			/>,
		);
		const label = findByProp(toJSON() as JsonNode, "text", "Add Transaction");
		expect(label).not.toBeNull();
	});

	it("carries the tint and label colors into their modifiers", async () => {
		const { toJSON } = await render(
			<TransactionFormCta
				canSave
				label="Save Changes"
				labelColor="#111111"
				onPress={() => {}}
				tintColor="#222222"
			/>,
		);
		const json = JSON.stringify(toJSON());
		expect(json).toContain('"$type":"tint","color":"#222222"');
		expect(json).toContain(
			'"$type":"foregroundStyle","styleType":"color","color":"#111111"',
		);
	});

	it("disables the button when canSave is false", async () => {
		const { toJSON } = await render(
			<TransactionFormCta
				canSave={false}
				label="Add Transaction"
				labelColor="#FFFFFF"
				onPress={() => {}}
				tintColor="#000000"
			/>,
		);
		expect(JSON.stringify(toJSON())).toContain(
			'"$type":"disabled","disabled":true',
		);
	});

	it("enables the button when canSave is true", async () => {
		const { toJSON } = await render(
			<TransactionFormCta
				canSave
				label="Add Transaction"
				labelColor="#FFFFFF"
				onPress={() => {}}
				tintColor="#000000"
			/>,
		);
		expect(JSON.stringify(toJSON())).toContain(
			'"$type":"disabled","disabled":false',
		);
	});
});
