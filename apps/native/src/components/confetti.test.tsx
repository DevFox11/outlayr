import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, screen } from "@testing-library/react-native";

import { celebration } from "@/lib/celebration";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { CelebrationConfetti } from "./confetti";

const mockReduced = jest.fn(() => false);

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<typeof import("react-native-reanimated")>("react-native-reanimated", () => {
    const actual = jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
    return { ...actual, __esModule: true, useReducedMotion: () => mockReduced() };
});

const burst = () => screen.queryByTestId("confetti");

const fire = () =>
    act(async () => {
        celebration.fire();
    });

describe("celebrationConfetti", () => {
    beforeEach(() => {
        mockReduced.mockReturnValue(false);
    });

    it("draws nothing until a burst fires", async () => {
        await render(<CelebrationConfetti />);

        expect(burst()).toBeNull();
    });

    it("plays a fresh burst for every fire", async () => {
        await render(<CelebrationConfetti />);

        await fire();
        const first = burst();
        await fire();

        expect(first).not.toBeNull();
        expect(burst()).not.toBeNull();
        expect(burst()).not.toBe(first);
    });

    it("leaves a burst fired before it mounted unplayed", async () => {
        celebration.fire();

        await render(<CelebrationConfetti />);

        expect(burst()).toBeNull();
    });

    it("stays still under reduced motion", async () => {
        mockReduced.mockReturnValue(true);
        await render(<CelebrationConfetti />);

        await fire();

        expect(burst()).toBeNull();
    });
});
