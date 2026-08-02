import { background } from "@expo/ui/swift-ui/modifiers";
import { render } from "@testing-library/react-native";
import { TransactionFormDetailsSection } from "./details-section";
import { CARD_SHAPE } from "./style";

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

const FAKE_NOTES = {
	value: "",
	get: () => "",
	set: () => {},
	onChange: null,
} as unknown as Parameters<typeof TransactionFormDetailsSection>[0]["notes"];

describe("TransactionFormDetailsSection", () => {
	it("renders the notes label passed in", async () => {
		const { toJSON } = await render(
			<TransactionFormDetailsSection
				card={[]}
				foregroundColor="#123456"
				notes={FAKE_NOTES}
				notesLabel="Notes"
				notesPlaceholder="Add a note"
			/>,
		);
		expect(findByProp(toJSON() as JsonNode, "text", "Notes")).not.toBeNull();
	});

	it("passes the placeholder through to the text field", async () => {
		const { toJSON } = await render(
			<TransactionFormDetailsSection
				card={[]}
				foregroundColor="#123456"
				notes={FAKE_NOTES}
				notesLabel="Notes"
				notesPlaceholder="Add a note"
			/>,
		);
		expect(
			findByProp(toJSON() as JsonNode, "placeholder", "Add a note"),
		).not.toBeNull();
	});

	it("carries the foreground color into the text field's modifiers", async () => {
		const { toJSON } = await render(
			<TransactionFormDetailsSection
				card={[]}
				foregroundColor="#ABCDEF"
				notes={FAKE_NOTES}
				notesLabel="Notes"
				notesPlaceholder="Add a note"
			/>,
		);
		expect(JSON.stringify(toJSON())).toContain(
			'"$type":"foregroundStyle","styleType":"color","color":"#ABCDEF"',
		);
	});

	it("appends the caller's card modifiers after its own padding", async () => {
		const { toJSON } = await render(
			<TransactionFormDetailsSection
				card={[background("#FF00FF", CARD_SHAPE)]}
				foregroundColor="#123456"
				notes={FAKE_NOTES}
				notesLabel="Notes"
				notesPlaceholder="Add a note"
			/>,
		);
		const tree = toJSON() as JsonNode;
		const modifiers = tree.props.modifiers as { $type: string }[];
		expect(modifiers.map((m) => m.$type)).toEqual(["padding", "background"]);
	});
});
