import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { testAppSettings as mockTestAppSettings } from "@/contexts/test-settings";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { OnboardingGrounding } from "./grounding";

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

const mockBool = jest.fn<(key: import("@/data/settings-core").BoolSettingKey) => boolean>();
jest.mock("@/contexts/display-settings-context", () => ({
    useAppSettings: () => mockTestAppSettings({ bool: mockBool }),
}));

beforeEach(() => {
    mockPush.mockClear();
    mockSetBoolSetting.mockClear();
    mockBool.mockReset();
    mockBool.mockReturnValue(true);
});

describe("onboarding grounding screen", () => {
    it("leaves the default true when onboarding is left untouched", async () => {
        const { getByText } = await render(<OnboardingGrounding />);

        fireEvent.press(getByText("common.continue"));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/rhythm"));
        expect(mockSetBoolSetting).toHaveBeenCalledTimes(1);
        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "groundedLookup", true);
    });

    it("persists false with no further prompt after turning it off then continuing", async () => {
        const { getByLabelText, getByText } = await render(<OnboardingGrounding />);

        await fireEvent(getByLabelText("onboarding.grounding.toggle"), "valueChange", false);
        fireEvent.press(getByText("common.continue"));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding/rhythm"));
        expect(mockSetBoolSetting).toHaveBeenCalledTimes(1);
        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "groundedLookup", false);
        expect(mockPush).toHaveBeenCalledTimes(1);
    });
});
