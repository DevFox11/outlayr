import { describe, expect, it, jest } from "@jest/globals";
import { Alert } from "react-native";

import type { TranslateFn } from "@/i18n/context";

import { budgetMenuItems } from "./budget-actions";

const t: TranslateFn = (key) => key;

describe("budgetMenuItems", () => {
    it("offers the limit then a destructive Delete", () => {
        const menu = budgetMenuItems({ onChangeLimit: jest.fn(), onDelete: jest.fn(), t });

        expect(menu.map((item) => item.id)).toStrictEqual(["limit", "delete"]);
        expect(menu.map((item) => item.destructive)).toStrictEqual([undefined, true]);
    });

    it("opens the limit without asking", () => {
        const onChangeLimit = jest.fn();
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        budgetMenuItems({ onChangeLimit, onDelete: jest.fn(), t })
            .find((item) => item.id === "limit")
            ?.onPress();

        expect(onChangeLimit).toHaveBeenCalledTimes(1);
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    it("deletes straight through, because the undo window is the confirmation", () => {
        const onDelete = jest.fn();
        const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

        budgetMenuItems({ onChangeLimit: jest.fn(), onDelete, t })
            .find((item) => item.id === "delete")
            ?.onPress();

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
