import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { TransactionFormAmountPad } from "./amount-pad";

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));
jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("../amount-numpad", () => {
    const react = require("react") as typeof import("react");
    return {
        AmountNumpad: (props: Record<string, unknown>) => react.createElement("AmountNumpad", props),
    };
});

const BASE = {
    code: "USD",
    income: false,
    label: "Amount",
    minorUnits: 2,
    onChange: () => {},
    stepKey: "amount",
    value: "4500",
};

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findByType(node: JsonNode | JsonNode[] | null, type: string): JsonNode | null {
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

const texts = (node: JsonNode | string | null): string[] => {
    if (node === null) {
        return [];
    }
    if (typeof node === "string") {
        return [node];
    }
    return (node.children ?? []).flatMap(texts);
};

describe("transactionFormAmountPad", () => {
    // The sentence above the pad already shows the figure; letting the keypad draw
    // its own puts two different amounts on screen at once.
    it("suppresses the keypad's own amount readout", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} />);
        const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
        expect(pad?.props.showDisplay).toBe(false);
    });

    it("forwards the entry state to the keypad", async () => {
        const onChange = jest.fn();
        const { toJSON } = await render(
            <TransactionFormAmountPad {...BASE} code="JPY" minorUnits={0} onChange={onChange} value="1234" />
        );
        const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
        expect(pad?.props.value).toBe("1234");
        expect(pad?.props.minorUnits).toBe(0);
        expect(pad?.props.code).toBe("JPY");
        expect(pad?.props.onChange).toBe(onChange);
    });

    it("tints the keypad for income", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} income />);
        const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
        expect(pad?.props.toneClass).toContain("income");
    });

    it("leaves the keypad untinted for an expense", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} income={false} />);
        const pad = findByType(toJSON() as JsonNode, "AmountNumpad");
        expect(pad?.props.toneClass).not.toContain("income");
    });

    // Docked, the pad has no sheet chrome to say what it is entering, and the
    // form can be showing either an amount or an exchange rate.
    it("names what it is entering", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} code="VES/USD" label="Entry rate" />);
        expect(texts(toJSON() as JsonNode)).toStrictEqual(expect.arrayContaining(["Entry rate", "VES/USD"]));
    });

    it("opens the currency picker from the code", async () => {
        const onCodePress = jest.fn();
        await render(<TransactionFormAmountPad {...BASE} onCodePress={onCodePress} />);

        // `Pressable`'s host view carries `onClick`, not `onPress` — see `amount-numpad.test.tsx`.
        await act(async () => {
            fireEvent(screen.getByLabelText("transaction.amount.changeCurrency"), "click");
        });

        expect(onCodePress).toHaveBeenCalledTimes(1);
    });

    // The rate pad's "VES/USD" is a pair, not a currency the picker can swap.
    it("leaves the code inert when nothing can be opened from it", async () => {
        await render(<TransactionFormAmountPad {...BASE} code="VES/USD" label="Entry rate" />);

        expect(screen.queryByLabelText("transaction.amount.changeCurrency")).toBeNull();
    });

    // The sentence directly above already states the amount, so naming the field
    // again is the one redundant word on the surface.
    it("drops the field name once the code is a control", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} onCodePress={() => {}} />);
        const rendered = texts(toJSON() as JsonNode);

        expect(rendered).not.toStrictEqual(expect.arrayContaining(["Amount"]));
        expect(rendered).toStrictEqual(expect.arrayContaining(["USD"]));
    });

    // Nothing presents it any more, so it sits on the home indicator unless it
    // carries the inset itself.
    it("clears the home indicator", async () => {
        const { toJSON } = await render(<TransactionFormAmountPad {...BASE} />);
        const root = toJSON() as JsonNode;
        expect(root.props.style).toStrictEqual(expect.objectContaining({ paddingBottom: 34 }));
    });
});
