import { describe, expect, it, jest } from "@jest/globals";
import { Alert } from "react-native";

import type { TranslateFn } from "@/i18n/context";

import { budgetMenuItems } from "./budget-actions";

const t: TranslateFn = (key) => key;

describe("budgetMenuItems", () => {
    it("offers Edit then a destructive Delete", () => {
        const menu = budgetMenuItems({ name: "Groceries", onDelete: jest.fn(), onEdit: jest.fn(), t });

        expect(menu.map((item) => item.id)).toStrictEqual(["edit", "delete"]);
        expect(menu.map((item) => item.destructive)).toStrictEqual([undefined, true]);
    });

    it("edits without asking", () => {
        const onEdit = jest.fn();
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        budgetMenuItems({ name: "Groceries", onDelete: jest.fn(), onEdit, t })
            .find((item) => item.id === "edit")
            ?.onPress();

        expect(onEdit).toHaveBeenCalledTimes(1);
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    it("routes Delete through its confirmation, which nothing else here undoes", () => {
        const onDelete = jest.fn();
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        budgetMenuItems({ name: "Groceries", onDelete, onEdit: jest.fn(), t })
            .find((item) => item.id === "delete")
            ?.onPress();

        expect(onDelete).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledTimes(1);
        alertSpy.mockRestore();
    });
});
