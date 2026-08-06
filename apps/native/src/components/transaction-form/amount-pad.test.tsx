import { fireEvent, render } from "@testing-library/react-native";
import { TransactionFormAmountPad } from "./amount-pad";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({ foreground: "#FFFFFF", muted: "#A4A4A9" }),
}));
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
	onDismiss: () => {},
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

	it("dismisses from its own control", async () => {
		const onDismiss = jest.fn();
		const { getByLabelText } = await render(
			<TransactionFormAmountPad {...BASE} onDismiss={onDismiss} />,
		);
		fireEvent.press(getByLabelText("common.done"));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("reports its measured height so the form can inset behind it", async () => {
		const onHeight = jest.fn();
		const { getByTestId } = await render(
			<TransactionFormAmountPad {...BASE} onHeight={onHeight} />,
		);
		fireEvent(getByTestId("amount-pad"), "layout", {
			nativeEvent: { layout: { height: 320 } },
		});
		expect(onHeight).toHaveBeenCalledWith(320);
	});
});
