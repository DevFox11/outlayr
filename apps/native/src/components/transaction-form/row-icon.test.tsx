import { Tag01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { render } from "@testing-library/react-native";
import { ROW_ICON_SIZE, TransactionFormRowIcon } from "./row-icon";

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findWithStyle(node: JsonNode | JsonNode[] | null): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findWithStyle(child);
			if (found) {
				return found;
			}
		}
		return null;
	}
	const style = node.props?.style as { width?: number } | undefined;
	if (style?.width != null) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child !== "string") {
			const found = findWithStyle(child);
			if (found) {
				return found;
			}
		}
	}
	return null;
}

describe("TransactionFormRowIcon", () => {
	// An RNHostView sized by flex alone collapses to zero inside a SwiftUI row,
	// so the glyph must carry explicit width and height.
	it("gives the hosted glyph an explicit square frame", async () => {
		const { toJSON } = await render(
			<TransactionFormRowIcon color="#A4A4A9" icon={Tag01Icon} />,
		);
		const sized = findWithStyle(toJSON() as JsonNode);
		expect(sized?.props.style).toStrictEqual({
			width: ROW_ICON_SIZE,
			height: ROW_ICON_SIZE,
		});
	});

	it("carries the tint down to the glyph", async () => {
		const { toJSON } = await render(
			<TransactionFormRowIcon color="#123456" icon={Tag01Icon} />,
		);
		expect(JSON.stringify(toJSON())).toContain("#123456");
	});
});
