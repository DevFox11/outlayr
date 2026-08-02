import { render } from "@testing-library/react-native";
import { TransactionFormAmountSection } from "./amount-section";

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

describe("TransactionFormAmountSection", () => {
	it("renders the label passed in", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountSection
				currency="USD"
				hairline={[]}
				label="Amount"
				onPress={() => {}}
				value="$12.50"
				valueColor="#123456"
			/>,
		);
		expect(findByProp(toJSON() as JsonNode, "text", "Amount")).not.toBeNull();
	});

	it("renders the formatted value and currency code passed in", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountSection
				currency="EUR"
				hairline={[]}
				label="Amount"
				onPress={() => {}}
				value="€40.00"
				valueColor="#123456"
			/>,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "€40.00")).not.toBeNull();
		expect(findByProp(tree, "text", "EUR")).not.toBeNull();
	});

	it("carries the value color into the amount text's modifiers", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountSection
				currency="USD"
				hairline={[]}
				label="Amount"
				onPress={() => {}}
				value="$0.00"
				valueColor="#ABCDEF"
			/>,
		);
		expect(JSON.stringify(toJSON())).toContain(
			'"$type":"foregroundStyle","styleType":"color","color":"#ABCDEF"',
		);
	});

	it("renders the hairline divider ahead of the row", async () => {
		const hairline = [{ $type: "padding", leading: 16 } as never];
		const { toJSON } = await render(
			<TransactionFormAmountSection
				currency="USD"
				hairline={hairline}
				label="Amount"
				onPress={() => {}}
				value="$0.00"
				valueColor="#123456"
			/>,
		);
		const tree = toJSON() as JsonNode;
		const [divider, button] = tree.children as JsonNode[];
		expect(divider.props.modifiers).toStrictEqual(hairline);
		expect(button.props.modifiers).toStrictEqual([
			{ $type: "buttonStyle", style: "plain" },
		]);
	});
});
