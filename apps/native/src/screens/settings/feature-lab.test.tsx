import { fireEvent, render } from "@testing-library/react-native";
import FeatureLabScreen from "./feature-lab";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

const mockSetBoolSetting = jest.fn();
jest.mock("@/data/settings", () => ({
	setBoolSetting: (...args: unknown[]) => mockSetBoolSetting(...args),
}));

const mockBool = jest.fn();
jest.mock("@/contexts/display-settings-context", () => ({
	useAppSettings: () => ({ state: { bool: mockBool } }),
	useDisplaySettings: () => ({ state: { swapTimeLabel: false } }),
}));

beforeEach(() => {
	mockSetBoolSetting.mockClear();
	mockBool.mockReset();
	mockBool.mockReturnValue(false);
});

describe("FeatureLabScreen — grounded lookup row", () => {
	it("reflects the setting's current true value", async () => {
		mockBool.mockImplementation((key: string) => key === "groundedLookup");

		const { getByLabelText } = await render(<FeatureLabScreen />);

		expect(
			getByLabelText("settings.featureLab.groundedLookup").props.value,
		).toBe(true);
	});

	it("writes the toggled value through setBoolSetting", async () => {
		const { getByLabelText } = await render(<FeatureLabScreen />);

		fireEvent(
			getByLabelText("settings.featureLab.groundedLookup"),
			"valueChange",
			false,
		);

		expect(mockSetBoolSetting).toHaveBeenCalledWith(
			expect.anything(),
			"groundedLookup",
			false,
		);
	});
});
