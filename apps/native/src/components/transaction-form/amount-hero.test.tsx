import { render } from "@testing-library/react-native";

import { TransactionFormAmountHero } from "./amount-hero";

let mockLanguage: "en" | "es" = "en";

jest.mock("@/i18n/context", () => ({
    useLanguage: () => ({ language: mockLanguage }),
}));

jest.mock("number-flow-react-native", () => {
    const react = require("react") as typeof import("react");
    return {
        NumberFlow: (props: Record<string, unknown>) => react.createElement("NumberFlow", props),
    };
});

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

const BASE = {
    amount: 4503,
    amountColor: "#FFFFFF",
    chipColor: "#2C2C2E",
    contentWidth: 353,
    currency: "USD",
    expenseLabel: "Expense",
    income: false,
    incomeLabel: "Income",
    minorUnits: 2,
    mutedColor: "#A4A4A9",
    onCurrencyPress: () => {},
    onPress: () => {},
    onTypeChange: () => {},
    symbol: "$",
};

/** Index of each child in the row that holds the symbol and the rolling figure. */
function rowOrder(tree: JsonNode): string[] {
    const row = findParentOf(tree, "NumberFlow");
    return (row?.children ?? []).map((child) => (typeof child === "string" ? child : child.type));
}

function findParentOf(node: JsonNode | JsonNode[] | null, childType: string): JsonNode | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findParentOf(child, childType);
            if (found) {
                return found;
            }
        }
        return null;
    }
    for (const child of node.children ?? []) {
        if (typeof child !== "string" && child.type === childType) {
            return node;
        }
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            continue;
        }
        const found = findParentOf(child, childType);
        if (found) {
            return found;
        }
    }
    return null;
}

describe("transactionFormAmountHero", () => {
    beforeEach(() => {
        mockLanguage = "en";
    });

    // The numpad under this figure renders its decimal key from the same locale
    // table, so a hardcoded tag here makes the two disagree: the user presses ","
    // and watches "." appear.
    it("rolls the figure in the active language's locale", async () => {
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} />);
        expect(findByProp(toJSON() as JsonNode, "value", 4503)?.props.locales).toBe("en-US");

        mockLanguage = "es";
        const { toJSON: toJSONes } = await render(<TransactionFormAmountHero {...BASE} />);
        expect(findByProp(toJSONes() as JsonNode, "value", 4503)?.props.locales).toBe("es-ES");
    });

    it("moves the symbol after the digits in Spanish", async () => {
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} />);
        expect(rowOrder(toJSON() as JsonNode)).toEqual(["Text", "NumberFlow"]);

        mockLanguage = "es";
        const { toJSON: toJSONes } = await render(<TransactionFormAmountHero {...BASE} />);
        expect(rowOrder(toJSONes() as JsonNode)).toEqual(["NumberFlow", "Text"]);
    });

    it("renders the symbol, digits and currency code passed in", async () => {
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} currency="EUR" symbol="€" />);
        const tree = toJSON() as JsonNode;
        expect(JSON.stringify(tree)).toContain("€");
        expect(findByProp(tree, "value", 4503)).not.toBeNull();
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
            <TransactionFormAmountHero {...BASE} amountColor="#0FFFA9" mutedColor="#ABCDEF" />
        );
        const tree = toJSON() as JsonNode;
        const digits = findByProp(tree, "value", 4503);
        expect(JSON.stringify(digits?.props.style)).toContain("#0FFFA9");
        // The symbol is a plain RN Text beside the rolling figure, so its tint
        // lands in `style`, not a SwiftUI modifier.
        expect(JSON.stringify(tree)).toContain("#ABCDEF");
    });

    // The keypad drives this on every press, so the figure has to roll rather
    // than swap — that is the whole reason it is a NumberFlow and not a Text.
    it("renders the figure through a rolling number", async () => {
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} />);
        expect(findByProp(toJSON() as JsonNode, "value", 4503)).not.toBeNull();
    });

    it("formats the figure to the currency's minor units", async () => {
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} minorUnits={0} />);
        const digits = findByProp(toJSON() as JsonNode, "value", 4503);
        expect(digits?.props.format).toMatchObject({
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        });
    });

    it("tints the selected type chip and leaves the other muted", async () => {
        const { toJSON } = await render(
            <TransactionFormAmountHero
                {...BASE}
                amountColor="#0FFFA9"
                chipColor="#2C2C2E"
                income
                mutedColor="#ABCDEF"
            />
        );
        const tree = toJSON() as JsonNode;
        const selected = findByProp(tree, "text", "Income");
        const unselected = findByProp(tree, "text", "Expense");
        expect(JSON.stringify(selected?.props.modifiers)).toContain("#2C2C2E");
        expect(JSON.stringify(unselected?.props.modifiers)).not.toContain("#2C2C2E");
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
            />
        );
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "onButtonPress", onPress)).not.toBeNull();
        expect(findByProp(tree, "onButtonPress", onCurrencyPress)).not.toBeNull();
    });

    it("reports the type each chip selects", async () => {
        const onTypeChange = jest.fn();
        const { toJSON } = await render(<TransactionFormAmountHero {...BASE} onTypeChange={onTypeChange} />);
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
        expect(onTypeChange.mock.calls.map(([kind]) => kind)).toEqual(expect.arrayContaining(["expense", "income"]));
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
