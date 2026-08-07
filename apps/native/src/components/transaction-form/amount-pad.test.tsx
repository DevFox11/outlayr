import { fireEvent, render } from "@testing-library/react-native";
import { TransactionFormAmountPad } from "./amount-pad";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#FFFFFF",
		muted: "#A4A4A9",
	}),
}));
jest.mock("panelui-native", () => {
	const react = require("react") as typeof import("react");
	const Content = ({ children, ...rest }: Record<string, unknown>) =>
		react.createElement("SheetContent", rest, children as never);
	const Root = ({ children, ...rest }: Record<string, unknown>) =>
		react.createElement("Sheet", rest, children as never);
	return { BottomSheet: Object.assign(Root, { Content }) };
});
jest.mock("../amount-numpad", () => {
	const react = require("react") as typeof import("react");
	return {
		AmountNumpad: (props: Record<string, unknown>) =>
			react.createElement("AmountNumpad", props),
	};
});

const BASE = {
	code: "USD",
	income: false,
	minorUnits: 2,
	onChange: () => {},
	onOpenChange: () => {},
	open: true,
	value: "4500",
};

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findByType(
	node: JsonNode | JsonNode[] | null,
	type: string,
): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByType(child, type);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.type === type) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child !== "string") {
			const found = findByType(child, type);
			if (found) {
				return found;
			}
		}
	}
	return null;
}

describe("TransactionFormAmountPad", () => {
	// The hero above the pad already shows the figure; letting the keypad draw
	// its own puts two different amounts on screen at once.
	it("suppresses the keypad's own amount readout", async () => {
		const { toJSON } = await render(<TransactionFormAmountPad {...BASE} />);
		const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
		expect(pad?.props.showDisplay).toBe(false);
	});

	it("forwards the entry state to the keypad", async () => {
		const onChange = jest.fn();
		const { toJSON } = await render(
			<TransactionFormAmountPad
				{...BASE}
				code="JPY"
				minorUnits={0}
				onChange={onChange}
				value="1234"
			/>,
		);
		const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
		expect(pad?.props.value).toBe("1234");
		expect(pad?.props.minorUnits).toBe(0);
		expect(pad?.props.code).toBe("JPY");
		expect(pad?.props.onChange).toBe(onChange);
	});

	it("tints the keypad for income", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountPad {...BASE} income />,
		);
		const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
		expect(pad?.props.toneClass).toContain("income");
	});

	it("leaves the keypad untinted for an expense", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountPad {...BASE} income={false} />,
		);
		const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
		expect(pad?.props.toneClass).not.toContain("income");
	});

	it("closes from its own control", async () => {
		const onOpenChange = jest.fn();
		const { getByLabelText } = await render(
			<TransactionFormAmountPad {...BASE} onOpenChange={onOpenChange} />,
		);
		fireEvent.press(getByLabelText("common.close"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// A swipe-down closes the sheet without going through the button, and the
	// form's `padOpen` has to follow or the sheet can never be reopened.
	it("reports a swipe-down dismissal back to the form", async () => {
		const onOpenChange = jest.fn();
		const { toJSON } = await render(
			<TransactionFormAmountPad {...BASE} onOpenChange={onOpenChange} />,
		);
		const sheet = findByType(toJSON() as JsonNode, "Sheet");
		expect(sheet?.props.open).toBe(true);
		const change = sheet?.props.onOpenChange as (next: boolean) => void;
		change(false);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// PanelUI's own close is `bg-muted`, which is a TEXT colour in this theme and
	// paints a grey slab — the glass button stands in for it.
	it("suppresses the sheet's built-in close button", async () => {
		const { toJSON } = await render(<TransactionFormAmountPad {...BASE} />);
		const content = findByType(toJSON() as JsonNode, "SheetContent");
		expect(content?.props.showClose).toBe(false);
	});
});
