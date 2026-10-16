import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { OnboardingSmartFeatures } from "./smart-features";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

const mockSetBoolSetting = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock<Partial<typeof import("@/data/settings-core")>>("@/data/settings-core", () => ({
    setBoolSetting: (...args: unknown[]) => mockSetBoolSetting(...args),
}));

beforeEach(() => {
    mockPush.mockClear();
    mockSetBoolSetting.mockClear();
});

describe("onboarding smart features screen", () => {
    it("records the consent and moves on when xAI is allowed", async () => {
        const { getByText } = await render(<OnboardingSmartFeatures />);

        fireEvent.press(getByText("aiConsent.allow"));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/rhythm"));
        expect(mockSetBoolSetting).toHaveBeenCalledTimes(1);
        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "aiConsent", true);
    });

    it("records Not now as an answer, so the launch sheet does not ask again", async () => {
        const { getByText } = await render(<OnboardingSmartFeatures />);

        fireEvent.press(getByText("aiConsent.notNow"));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/rhythm"));
        expect(mockSetBoolSetting).toHaveBeenCalledTimes(1);
        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "aiConsent", false);
    });
});
