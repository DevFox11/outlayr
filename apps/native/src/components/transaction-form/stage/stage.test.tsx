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
});
