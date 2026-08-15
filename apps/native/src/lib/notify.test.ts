import { describe, expect, it, jest } from "@jest/globals";
import { toast } from "panelui-native";

import { notifyFailure, notifyUndoable } from "./notify";

describe("notifyFailure", () => {
    it("raises a destructive toast at the top of the screen", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-1");

        notifyFailure({ body: "Check your connection.", title: "Sync failed" });

        expect(showSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                description: "Check your connection.",
                label: "Sync failed",
                placement: "top",
                variant: "destructive",
            })
        );
        showSpy.mockRestore();
    });

    it("passes an action through so a failure can offer a retry", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-2");
        const onActionPress = jest.fn();

        notifyFailure({ actionLabel: "Retry", onActionPress, title: "Couldn't stop it" });

        expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({ actionLabel: "Retry", onActionPress }));
        showSpy.mockRestore();
    });

    it("holds an actionable notice longer than one that only has to be read", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-3");

        notifyFailure({ title: "Read me" });
        notifyFailure({ actionLabel: "Retry", onActionPress: jest.fn(), title: "Act on me" });

        // `show` also takes a bare string, which carries no duration at all.
        const [plain, actionable] = showSpy.mock.calls.map(([options]) =>
            typeof options === "string" ? 0 : (options.duration ?? 0)
        );
        expect(actionable).toBeGreaterThan(plain);
        showSpy.mockRestore();
    });
});

describe("notifyUndoable", () => {
    it("is neutral rather than destructive, and honours the window it is given", () => {
        const showSpy = jest.spyOn(toast, "show").mockReturnValue("toast-4");

        notifyUndoable({ actionLabel: "Undo", duration: 10_000, onActionPress: jest.fn(), title: "Log deleted" });

        expect(showSpy).toHaveBeenCalledWith(
            expect.objectContaining({ duration: 10_000, placement: "top", variant: "default" })
        );
        showSpy.mockRestore();
    });
});
