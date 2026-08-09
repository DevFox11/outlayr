import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { OnboardingGrounding } from "./grounding";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/i18n/context", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("@/contexts/local-data-context", () => ({
	useDatabase: () => ({}),
}));

const mockSetBoolSetting = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock("@/data/settings-core", () => ({
	setBoolSetting: (...args: unknown[]) => mockSetBoolSetting(...args),
}));

const mockBool = jest.fn();
jest.mock("@/contexts/display-settings-context", () => ({
	useAppSettings: () => ({ state: { bool: mockBool } }),
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
