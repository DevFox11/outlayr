import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import {
    testAppSettings as mockTestAppSettings,
    testDisplaySettingsValue as mockTestDisplaySettingsValue,
} from "@/contexts/test-settings";
import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";

import { FeatureLab } from "./feature-lab";

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

const mockSetBoolSetting = jest.fn();
jest.mock("@/data/settings-core", () => ({
    setBoolSetting: (...args: unknown[]) => mockSetBoolSetting(...args),
}));

const mockBool = jest.fn<(key: import("@/data/settings-core").BoolSettingKey) => boolean>();
jest.mock("@/contexts/display-settings-context", () => ({
    useAppSettings: () => mockTestAppSettings({ bool: mockBool }),
    useDisplaySettings: () => mockTestDisplaySettingsValue({ swapTimeLabel: false }),
}));

beforeEach(() => {
    mockSetBoolSetting.mockClear();
    mockBool.mockReset();
    mockBool.mockReturnValue(false);
});

describe("featureLab — grounded lookup row", () => {
    it("reflects the setting's current true value", async () => {
        mockBool.mockImplementation((key: string) => key === "groundedLookup");

        const { getByLabelText } = await render(<FeatureLab />);

        expect(getByLabelText("settings.featureLab.groundedLookup").props.value).toBe(true);
    });

    it("writes the toggled value through setBoolSetting", async () => {
        const { getByLabelText } = await render(<FeatureLab />);

        fireEvent(getByLabelText("settings.featureLab.groundedLookup"), "valueChange", false);

        expect(mockSetBoolSetting).toHaveBeenCalledWith(expect.anything(), "groundedLookup", false);
    });
});
