import { transactionFormCtaActions } from "./cta";

const BASE = {
    canSave: true,
    deleteLabel: "Delete",
    onPress: () => {},
    saveLabel: "Save",
};

describe("transactionFormCtaActions", () => {
    it("offers only save when there is nothing to delete", () => {
        expect(transactionFormCtaActions(BASE).map((a) => a.key)).toEqual(["save"]);
    });

    // Destructive on the inside of the pair, so the outermost item under the
    // thumb — the one an edge tap lands on — is Save rather than Delete.
    it("puts delete before save once a delete handler is given", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            onDelete: () => {},
        });
        expect(actions.map((a) => a.key)).toEqual(["delete", "save"]);
    });

    it("uses a distinct icon for each action", () => {
        const actions = transactionFormCtaActions({
            ...BASE,
            onDelete: () => {},
        });
        expect(actions.map((a) => a.icon)).toEqual(["delete", "done"]);
    });

    it("disables save when the form cannot be saved", () => {
        const [save] = transactionFormCtaActions({ ...BASE, canSave: false });
        expect(save?.disabled).toBe(true);
    });

    it("enables save when the form can be saved", () => {
        const [save] = transactionFormCtaActions({ ...BASE, canSave: true });
        expect(save?.disabled).toBe(false);
    });

    // An unsaveable draft is still deletable — only save is ever dimmed.
    it("leaves delete enabled while save is disabled", () => {
        const [remove, save] = transactionFormCtaActions({
            ...BASE,
            canSave: false,
            onDelete: () => {},
        });
        expect(remove?.disabled).toBe(false);
        expect(save?.disabled).toBe(true);
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
        expect(actions.map((a) => a.accessibilityLabel)).toEqual(["Delete entry", "Save changes"]);
    });
});
