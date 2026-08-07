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
jest.mock("@expo/ui/swift-ui", () => {
	const react = require("react") as typeof import("react");
	const passthrough =
		(name: string) =>
		({ children, ...rest }: Record<string, unknown>) =>
			react.createElement(name, rest, children as never);
	return {
		BottomSheet: passthrough("BottomSheet"),
		Group: passthrough("Group"),
		// `pointerEvents` is dropped: the real Host is an empty absolute anchor and
		// the sheet is presented natively above it, so the prop never reaches this
		// content on device — but RNTL walks the RN tree and would block the press.
		Host: ({ children }: Record<string, unknown>) =>
			react.createElement("Host", null, children as never),
		RNHostView: passthrough("RNHostView"),
	};
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
		fireEvent.press(getByLabelText("common.done"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// A swipe-down closes the sheet without going through the button, and the
	// form's `padOpen` has to follow or the sheet can never be reopened.
	it("reports a swipe-down dismissal back to the form", async () => {
		const onOpenChange = jest.fn();
		const { toJSON } = await render(
			<TransactionFormAmountPad {...BASE} onOpenChange={onOpenChange} />,
		);
		const sheet = findByType(toJSON() as JsonNode, "BottomSheet");
		expect(sheet?.props.isPresented).toBe(true);
		const change = sheet?.props.onIsPresentedChange as (next: boolean) => void;
		change(false);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// The system backdrop is what dims and blocks the form behind the keypad;
	// without this the "tap another row to close" wiring is unreachable.
	it("drops the sheet's dimming backdrop", async () => {
		const { toJSON } = await render(<TransactionFormAmountPad {...BASE} />);
		const group = findByType(toJSON() as JsonNode, "Group");
		expect(JSON.stringify(group?.props.modifiers)).toContain(
			'"$type":"presentationBackgroundInteraction","interactionType":"enabled"',
		);
	});
});
