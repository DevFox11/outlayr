import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import type { Category, CategoryWithChildren } from "@/data/categories-core";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepCategory } from "./step-category";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const category = (id: string, name: string, overrides: Partial<Category> = {}): Category => ({
    color: "#B56858",
    dateCreated: new Date(0),
    deletedAt: null,
    emoji: null,
    icon: null,
    id,
    income: false,
    name,
    parentId: null,
    sortOrder: 0,
    updatedAt: new Date(0),
    ...overrides,
});

const holder = (id: string, name: string, children: Category[] = []): CategoryWithChildren => ({
    ...category(id, name),
    children,
});

const CATEGORIES: CategoryWithChildren[] = [
    holder("transport", "Transport", [category("fuel", "Fuel", { parentId: "transport" })]),
    holder("rent", "Rent"),
];

const baseProps: ComponentProps<typeof StepCategory> = {
    categories: CATEGORIES,
    onSelect: jest.fn(),
    selectedId: null,
};

const optionNames = () => screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);

describe("stepCategory", () => {
    // A row of pills has no disclosure to nest a child under, so a child carries
    // its holder — two same-named leaves are otherwise the same pill twice.
    it("lists a holder before its own children, and states the holder on a child", async () => {
        await render(<StepCategory {...baseProps} />);

        expect(optionNames()).toStrictEqual(["Transport", "Transport › Fuel", "Rent"]);
    });

    it("marks the selected category", async () => {
        await render(<StepCategory {...baseProps} selectedId="fuel" />);

        expect(screen.getByRole("button", { name: "Transport › Fuel" }).props.accessibilityState.selected).toBe(true);
        expect(screen.getByRole("button", { name: "Rent" }).props.accessibilityState.selected).toBe(false);
    });

    it("reports the whole category, not just its id", async () => {
        const onSelect = jest.fn();
        await render(<StepCategory {...baseProps} onSelect={onSelect} />);

        fireEvent.press(screen.getByRole("button", { name: "Transport › Fuel" }));

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "fuel", parentId: "transport" }));
    });

    it("leaves creating one out where the host cannot mint it", async () => {
        await render(<StepCategory {...baseProps} />);

        expect(screen.queryByRole("button", { name: "categories.addCategory" })).toBeNull();
    });

    it("offers creating one where it can", async () => {
        const onCreate = jest.fn();
        await render(<StepCategory {...baseProps} onCreate={onCreate} />);

        fireEvent.press(screen.getByRole("button", { name: "categories.addCategory" }));

        expect(onCreate).toHaveBeenCalledTimes(1);
    });
});
