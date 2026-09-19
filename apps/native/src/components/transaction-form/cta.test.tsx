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

const BASE = {
    canSave: true,
    deleteLabel: "Delete",
    onPress: () => {},
    saveLabel: "Save",
};

describe("transactionFormCtaActions", () => {
    it("offers only save when there is nothing to delete", () => {
        expect(transactionFormCtaActions(BASE).map((a) => a.key)).toStrictEqual(["save"]);
    });

    // Destructive on the inside of the pair, so the outermost item under the
    // thumb — the one an edge tap lands on — is Save rather than Delete.
    it("puts delete before save once a delete handler is given", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            onDelete: () => {},
        });
        expect(actions.map((a) => a.key)).toStrictEqual(["delete", "save"]);
    });

    it("puts lookup furthest from the thumb, and holds it while a lookup is out", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            lookupBusy: true,
            lookupLabel: "Look up merchant",
            onDelete: () => {},
            onLookup: () => {},
        });
        expect(actions.map((a) => a.key)).toStrictEqual(["lookup", "delete", "save"]);
        expect(actions[0]).toMatchObject({ disabled: true, icon: "search" });
    });

    it("uses a distinct icon for each action", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            onDelete: () => {},
        });
        expect(actions.map((a) => a.icon)).toStrictEqual(["delete", "done"]);
    });

    // Never disabled: pressing a blocked save is how the form is asked what is missing.
    it("keeps save pressable but unprominent when the form cannot be saved", () => {
        const [save] = transactionFormCtaActions({ ...BASE, canSave: false });
        expect(save?.disabled).toBe(false);
        expect(save?.variant).toBeUndefined();
    });

    it("promotes save when the form can be saved", () => {
        const [save] = transactionFormCtaActions({ ...BASE, canSave: true });
        expect(save?.disabled).toBe(false);
        expect(save?.variant).toBe("done");
    });

    // The one state that refuses the press: a second tap mid-flight re-enters submit.
    it("disables save only while a submit is in flight", () => {
        const [save] = transactionFormCtaActions({ ...BASE, busy: true, canSave: false });
        expect(save?.disabled).toBe(true);
    });

    it("dims a blocked save with the tint it is given", () => {
        const [save] = transactionFormCtaActions({ ...BASE, blockedTint: "#8b8377", canSave: false });
        expect(save?.tintColor).toBe("#8b8377");
    });

    // An unsaveable draft is still deletable — only save is ever dimmed.
    it("leaves delete alone while save is blocked", () => {
        const [remove, save] = transactionFormCtaActions({
            ...BASE,
            canSave: false,
            onDelete: () => {},
        });
        expect(remove?.disabled).toBe(false);
        expect(save?.disabled).toBe(false);
        expect(save?.variant).toBeUndefined();
    });

    it("wires each action to its own handler", () => {
        const onPress = jest.fn();
        const onDelete = jest.fn();
        const [remove, save] = transactionFormCtaActions({
            ...BASE,
            onDelete,
            onPress,
        });
        remove?.onPress();
        save?.onPress();
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("carries the destructive tint onto delete alone", () => {
        const [remove, save] = transactionFormCtaActions({
            ...BASE,
            deleteTint: "#DA0F01",
            onDelete: () => {},
        });
        expect(remove?.tintColor).toBe("#DA0F01");
        expect(save?.tintColor).toBeUndefined();
    });

    it("carries both labels through to their own action", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            deleteLabel: "Delete entry",
            onDelete: () => {},
            saveLabel: "Save changes",
        });
        expect(actions.map((a) => a.accessibilityLabel)).toStrictEqual(["Delete entry", "Save changes"]);
    });
});

describe("toolbar", () => {
    it("is not rebuilt by a render that only changes the handlers, and presses reach the latest one", async () => {
        const first = jest.fn();
        const second = jest.fn();
        const view = await render(<TransactionFormCta canSave onPress={first} saveLabel="Save" />);
        await view.rerender(<TransactionFormCta canSave onPress={second} saveLabel="Save" />);
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
