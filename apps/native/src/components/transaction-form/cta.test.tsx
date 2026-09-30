import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { TransactionFormCta, transactionFormCtaActions } from "./cta";

const mockToolbarRenders = jest.fn();

jest.mock<Partial<typeof import("expo-router")>>("expo-router", () => {
    const stub = require("../../../jest/expo-router-stub");
    const Toolbar = (props: { children: ReactNode }) => {
        mockToolbarRenders();
        return stub.Stack.Toolbar(props);
    };
    Toolbar.Button = stub.Stack.Toolbar.Button;
    return { ...stub, Stack: { Toolbar } };
});

describe("transactionFormCtaActions", () => {
    it("puts nothing in the bar of a new entry", async () => {
        expect(transactionFormCtaActions({})).toStrictEqual([]);
        const view = await render(<TransactionFormCta />);
        expect(view.toJSON()).toBeNull();
    });

    it("puts lookup before delete, and holds it while a lookup is out", () => {
        const actions = transactionFormCtaActions({
            deleteLabel: "Delete",
            lookupBusy: true,
            lookupLabel: "Look up merchant",
            onDelete: () => {},
            onLookup: () => {},
        });
        expect(actions.map((a) => a.key)).toStrictEqual(["lookup", "delete"]);
        expect(actions.map((a) => a.icon)).toStrictEqual(["search", "delete"]);
        expect(actions.map((a) => a.accessibilityLabel)).toStrictEqual(["Look up merchant", "Delete"]);
        expect(actions.map((a) => a.disabled)).toStrictEqual([true, false]);
    });

    it("wires each action to its own handler", () => {
        const onDelete = jest.fn();
        const onLookup = jest.fn();
        const [lookup, remove] = transactionFormCtaActions({ onDelete, onLookup });
        lookup?.onPress();
        remove?.onPress();
        expect(onLookup).toHaveBeenCalledTimes(1);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("carries the destructive tint onto delete alone", () => {
        const [lookup, remove] = transactionFormCtaActions({
            deleteTint: "#DA0F01",
            onDelete: () => {},
            onLookup: () => {},
        });
        expect(remove?.tintColor).toBe("#DA0F01");
        expect(lookup?.tintColor).toBeUndefined();
    });
});

describe("toolbar", () => {
    it("is not rebuilt by a render that only changes the handlers, and presses reach the latest one", async () => {
        const first = jest.fn();
        const second = jest.fn();
        const view = await render(<TransactionFormCta deleteLabel="Delete" onDelete={first} />);
        await view.rerender(<TransactionFormCta deleteLabel="Delete" onDelete={second} />);
        expect(mockToolbarRenders).toHaveBeenCalledTimes(1);
        const button = view.toJSON();
        if (button === null || Array.isArray(button)) {
            throw new Error("expected a single toolbar button");
        }
        button.props.onButtonPress();
        expect(second).toHaveBeenCalledTimes(1);
        expect(first).not.toHaveBeenCalled();
    });
});
