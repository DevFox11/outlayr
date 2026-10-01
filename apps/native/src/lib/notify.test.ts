import { describe, expect, it, jest } from "@jest/globals";
import { toast } from "panelui-native";
import type { ToastOptions } from "panelui-native";
import { isValidElement } from "react";

import type { NoticeSlipProps } from "@/components/notice-slip";

import { notifyFailure, notifySaved, notifyUndoable } from "./notify";

function shown(options: ToastOptions | string | undefined) {
    const handle = { hide: jest.fn(), id: "toast" };
    const slip = typeof options === "string" ? null : options?.component?.(handle);
    if (!isValidElement<NoticeSlipProps>(slip)) {
        throw new Error("Expected the notice to render a NoticeSlip");
    }
    return { handle, props: slip.props };
}

describe("notifyFailure", () => {
    it("raises a failure slip at the top of the screen", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-1");

        notifyFailure({ body: "Check your connection.", title: "Sync failed" });

        const [[options]] = showSpy.mock.calls;
        expect(options).toMatchObject({ placement: "top" });
        expect(shown(options).props).toMatchObject({
            body: "Check your connection.",
            title: "Sync failed",
            tone: { kind: "failure" },
        });
        showSpy.mockRestore();
    });

    it("passes an action through so a failure can offer a retry", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-2");
        const onActionPress = jest.fn();

        notifyFailure({ actionLabel: "Retry", onActionPress, title: "Couldn't stop it" });

        const { handle, props } = shown(showSpy.mock.calls[0]?.[0]);
        expect(props.actionLabel).toBe("Retry");
        props.onAction?.();
        expect(onActionPress).toHaveBeenCalledWith(handle);
        showSpy.mockRestore();
    });

    it("holds an actionable notice longer than one that only has to be read", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-3");

        notifyFailure({ title: "Read me" });
        notifyFailure({ actionLabel: "Retry", onActionPress: jest.fn(), title: "Act on me" });

        const [plain, actionable] = showSpy.mock.calls.map(([options]) =>
            typeof options === "string" ? 0 : (options.duration ?? 0)
        );
        expect(actionable).toBeGreaterThan(plain);
        showSpy.mockRestore();
    });

    it("can be dismissed with the escape gesture, which a swipe-only toast would not allow", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-4");

        notifyFailure({ title: "Not saved" });

        const { handle, props } = shown(showSpy.mock.calls[0]?.[0]);
        props.onDismiss?.();
        expect(handle.hide).toHaveBeenCalledTimes(1);
        showSpy.mockRestore();
    });
});

describe("notifyUndoable", () => {
    it("is neutral rather than a failure, and honours the window it is given", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-5");

        notifyUndoable({ actionLabel: "Undo", duration: 10_000, onActionPress: jest.fn(), title: "Log deleted" });

        const [[options]] = showSpy.mock.calls;
        expect(options).toMatchObject({ duration: 10_000, placement: "top" });
        expect(shown(options).props.tone).toStrictEqual({ kind: "removed" });
        showSpy.mockRestore();
    });
});

describe("notifySaved", () => {
    it("runs the action, then dismisses the toast it was pressed on", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-6");
        const onActionPress = jest.fn();
        const end = { customColor: null, emoji: null, icon: null, imageColor: null, imageUri: null };

        notifySaved({
            actionLabel: "Add another",
            amount: { label: "Transfer $50.00", text: "$50.00" },
            onActionPress,
            stamp: "Transfer added",
            title: "Mercantil",
            tone: { ends: { from: { ...end, name: "Chase" }, to: { ...end, name: "Mercantil" } }, kind: "transfer" },
        });

        const { handle, props } = shown(showSpy.mock.calls[0]?.[0]);
        props.onAction?.();

        expect(onActionPress).toHaveBeenCalledWith(handle);
        expect(handle.hide).toHaveBeenCalledTimes(1);
        showSpy.mockRestore();
    });
});
