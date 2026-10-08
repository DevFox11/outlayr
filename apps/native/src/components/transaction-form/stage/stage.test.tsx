import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, userEvent } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { Text } from "../../text";
import { StagePartContext, TransactionStage } from "./stage";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 59 }),
}));

const mockLargeText = jest.fn(() => false);
jest.mock<Partial<typeof import("@/hooks/use-accessibility-text-size")>>("@/hooks/use-accessibility-text-size", () => ({
    useAccessibilityTextSize: () => mockLargeText(),
}));

describe("transactionStage", () => {
    beforeEach(() => {
        mockLargeText.mockReturnValue(false);
    });

    it("renders no footer when none is given", async () => {
        await render(
            <TransactionStage stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        expect(screen.queryByTestId("stage-footer")).toBeNull();
    });

    it("renders the footer it is given and reports its label", async () => {
        await render(
            <TransactionStage footer={{ label: "Next", onPress: () => {} }} stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    });

    it("stays whole when pinned at standard text sizes", async () => {
        await render(
            <StagePartContext value="pinned">
                <TransactionStage footer={{ label: "Next", onPress: () => {} }} stepKey="amount" title="New">
                    <Text>body</Text>
                </TransactionStage>
            </StagePartContext>
        );
        expect(screen.getByText("body")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    });

    it("pins the footer alone at accessibility text sizes", async () => {
        mockLargeText.mockReturnValue(true);
        await render(
            <StagePartContext value="pinned">
                <TransactionStage footer={{ label: "Next", onPress: () => {} }} stepKey="amount" title="New">
                    <Text>body</Text>
                </TransactionStage>
            </StagePartContext>
        );
        expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
        expect(screen.queryByText("body")).toBeNull();
    });

    it("leaves the footer out of the inline part", async () => {
        mockLargeText.mockReturnValue(true);
        await render(
            <StagePartContext value="inline">
                <TransactionStage footer={{ label: "Next", onPress: () => {} }} stepKey="amount" title="New">
                    <Text>body</Text>
                </TransactionStage>
            </StagePartContext>
        );
        expect(screen.getByText("body")).toBeTruthy();
        expect(screen.queryByTestId("stage-footer")).toBeNull();
    });

    it("runs the footer's own handler", async () => {
        const onPress = jest.fn();
        await render(
            <TransactionStage footer={{ label: "Save", onPress }} stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        await userEvent.press(screen.getByRole("button", { name: "Save" }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("swaps the body when the step key changes", async () => {
        const view = await render(
            <TransactionStage stepKey="amount" title="New">
                <Text>amount body</Text>
            </TransactionStage>
        );
        expect(screen.getByText("amount body")).toBeTruthy();

        await view.rerender(
            <TransactionStage stepKey="category" title="New">
                <Text>category body</Text>
            </TransactionStage>
        );
        expect(screen.queryByText("amount body")).toBeNull();
        expect(screen.getByText("category body")).toBeTruthy();
    });

    // The key is what makes the arrival animate. Same key, new children, and
    // Reanimated would hold the settled frame instead.
    it("re-keys the body on every step", async () => {
        const view = await render(
            <TransactionStage stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        const first = screen.getByTestId("stage-body");
        await view.rerender(
            <TransactionStage stepKey="category" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        expect(screen.getByTestId("stage-body")).not.toBe(first);
    });

    it("offers no back chevron until it is given one", async () => {
        await render(
            <TransactionStage stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    });

    it("labels the back chevron and runs its handler", async () => {
        const onBack = jest.fn();
        await render(
            <TransactionStage backLabel="Back" onBack={onBack} stepKey="category" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        await userEvent.press(screen.getByRole("button", { name: "Back" }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("turns a right action into its own tap target", async () => {
        const onPress = jest.fn();
        await render(
            <TransactionStage rightAction={{ label: "USD", onPress }} stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        await userEvent.press(screen.getByRole("button", { name: "USD" }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("draws right meta given as a node without wrapping it in a button", async () => {
        await render(
            <TransactionStage right={<Text>3 of 4</Text>} stepKey="amount" title="New">
                <Text>body</Text>
            </TransactionStage>
        );
        expect(screen.getByText("3 of 4")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "3 of 4" })).toBeNull();
    });
});
