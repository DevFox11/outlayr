import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { TransactionFormCta } from "./cta";
import { transactionFormCtaActions } from "./cta-actions";

const mockToolbarRenders = jest.fn();
const mockKeyboardShown = jest.fn<() => boolean>(() => false);

jest.mock("./stage/use-keyboard-shown", () => ({ useKeyboardShown: () => mockKeyboardShown() }));

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
});

describe("save while typing", () => {
    const SAVE = { busy: false, label: "Add Transaction", onPress: () => {}, ready: true };

    it("joins the bar, after delete, while the keyboard covers the footer", async () => {
        mockKeyboardShown.mockReturnValue(true);
        const onPress = jest.fn();
        const view = await render(
            <TransactionFormCta deleteLabel="Delete" onDelete={() => {}} save={{ ...SAVE, onPress }} />
        );
        const bar = view.toJSON();
        if (bar === null || Array.isArray(bar)) {
            throw new TypeError("expected one toolbar");
        }
        const buttons = (bar.children ?? []).filter((child) => typeof child !== "string");
        expect(buttons.map((button) => button.props.accessibilityLabel)).toStrictEqual(["Delete", "Add Transaction"]);
        buttons[1]?.props.onButtonPress();
        expect(onPress).toHaveBeenCalledTimes(1);
        mockKeyboardShown.mockReturnValue(false);
    });

    it("keeps its press while the entry is not whole, and only loses its prominence", () => {
        const [save] = transactionFormCtaActions({ save: { ...SAVE, blockedTint: "#999999", ready: false } });
        expect(save).toMatchObject({ disabled: false, key: "save", tintColor: "#999999", variant: undefined });
        const [ready] = transactionFormCtaActions({ save: SAVE });
        expect(ready).toMatchObject({ tintColor: undefined, variant: "done" });
    });

    it("waits out a save that is already in flight", () => {
        const [save] = transactionFormCtaActions({ save: { ...SAVE, busy: true } });
        expect(save?.disabled).toBe(true);
    });
});

describe("toolbar", () => {
    it("is not rebuilt by a render that only changes the handlers, and presses reach the latest one", async () => {
        mockToolbarRenders.mockClear();
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
