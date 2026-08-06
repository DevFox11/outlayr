import { render } from "@testing-library/react-native";
import { TransactionFormAmountHero } from "./amount-hero";

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

const BASE = {
	amountColor: "#FFFFFF",
	chipColor: "#2C2C2E",
	currency: "USD",
	digits: "4,503.00",
	expenseLabel: "Expense",
	income: false,
	incomeLabel: "Income",
	mutedColor: "#A4A4A9",
	onCurrencyPress: () => {},
	onPress: () => {},
	onTypeChange: () => {},
	symbol: "$",
};

describe("TransactionFormAmountHero", () => {
	it("renders the symbol, digits and currency code passed in", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountHero {...BASE} currency="EUR" symbol="€" />,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "€")).not.toBeNull();
		expect(findByProp(tree, "text", "4,503.00")).not.toBeNull();
		expect(findByProp(tree, "text", "EUR")).not.toBeNull();
	});

	it("renders both type labels", async () => {
		const { toJSON } = await render(<TransactionFormAmountHero {...BASE} />);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "Expense")).not.toBeNull();
		expect(findByProp(tree, "text", "Income")).not.toBeNull();
	});

	it("carries the amount color into the digits, not the symbol", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountHero
				{...BASE}
				amountColor="#0FFFA9"
				mutedColor="#ABCDEF"
			/>,
		);
		const tree = toJSON() as JsonNode;
		const digits = findByProp(tree, "text", "4,503.00");
		const symbol = findByProp(tree, "text", "$");
		expect(JSON.stringify(digits?.props.modifiers)).toContain(
			'"$type":"foregroundStyle","styleType":"color","color":"#0FFFA9"',
		);
		expect(JSON.stringify(symbol?.props.modifiers)).toContain(
			'"$type":"foregroundStyle","styleType":"color","color":"#ABCDEF"',
		);
	});

	// The digits are re-rendered on every keypress; without fixed-width figures
	// the whole number shifts sideways as each digit lands.
	it("renders the digits with fixed-width figures", async () => {
		const { toJSON } = await render(<TransactionFormAmountHero {...BASE} />);
		const digits = findByProp(toJSON() as JsonNode, "text", "4,503.00");
		expect(JSON.stringify(digits?.props.modifiers)).toContain(
			'"$type":"monospacedDigit"',
		);
	});

	it("tints the selected type chip and leaves the other muted", async () => {
		const { toJSON } = await render(
			<TransactionFormAmountHero
				{...BASE}
				amountColor="#0FFFA9"
				chipColor="#2C2C2E"
				income
				mutedColor="#ABCDEF"
			/>,
		);
		const tree = toJSON() as JsonNode;
		const selected = findByProp(tree, "text", "Income");
		const unselected = findByProp(tree, "text", "Expense");
		expect(JSON.stringify(selected?.props.modifiers)).toContain("#2C2C2E");
		expect(JSON.stringify(unselected?.props.modifiers)).not.toContain(
			"#2C2C2E",
		);
		expect(JSON.stringify(unselected?.props.modifiers)).toContain("#ABCDEF");
	});

	it("wires each control to its own handler", async () => {
		const onPress = jest.fn();
		const onCurrencyPress = jest.fn();
		const onTypeChange = jest.fn();
		const { toJSON } = await render(
			<TransactionFormAmountHero
				{...BASE}
				onCurrencyPress={onCurrencyPress}
				onPress={onPress}
				onTypeChange={onTypeChange}
			/>,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "onButtonPress", onPress)).not.toBeNull();
		expect(findByProp(tree, "onButtonPress", onCurrencyPress)).not.toBeNull();
	});

	it("reports the type each chip selects", async () => {
		const onTypeChange = jest.fn();
		const { toJSON } = await render(
			<TransactionFormAmountHero {...BASE} onTypeChange={onTypeChange} />,
		);
		const tree = toJSON() as JsonNode;
		const expense = findByProp(tree, "text", "Expense");
		const income = findByProp(tree, "text", "Income");
		// Each chip's own Button is its parent, so walking the tree for the two
		// press handlers and firing them proves the labels are not swapped.
		const presses: (() => void)[] = [];
		collectPresses(tree, presses);
		for (const press of presses) {
			press();
		}
		expect(expense).not.toBeNull();
		expect(income).not.toBeNull();
		expect(onTypeChange.mock.calls.map(([kind]) => kind)).toEqual(
			expect.arrayContaining(["expense", "income"]),
		);
	});
});

function collectPresses(node: JsonNode | null, out: (() => void)[]): void {
	if (node == null) {
		return;
	}
	const handler = node.props?.onButtonPress;
	if (typeof handler === "function") {
		out.push(handler as () => void);
	}
	for (const child of node.children ?? []) {
		if (typeof child !== "string") {
			collectPresses(child, out);
		}
	}
}
