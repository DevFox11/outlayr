import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { THEME_OPTIONS, themePreferenceForValue, valueForThemePreference } from "./theme-preference";
import { useApplyThemePreference } from "./use-theme-preference";

const mockSetTheme = jest.fn();
const stored = { colorScheme: 0 };

jest.mock("panelui-native", () => ({
	useTheme: () => ({ setTheme: mockSetTheme, theme: "light" }),
}));

jest.mock("@/contexts/display-settings-context", () => ({
	useSettingNumber: (key: string) => (key === "colorScheme" ? stored.colorScheme : 0),
}));

function Probe() {
	return <Text testID="preference">{useApplyThemePreference()}</Text>;
}

beforeEach(() => {
	mockSetTheme.mockClear();
	stored.colorScheme = 0;
});

describe("the stored colour scheme", () => {
	it("round-trips every option", () => {
		for (const option of THEME_OPTIONS) {
			expect(themePreferenceForValue(valueForThemePreference(option.preference))).toBe(option.preference);
		}
	});

	// The value comes off disk, so a number nobody wrote must not strand the app
	// on a theme that does not exist.
	it("falls back to following the device for a value it does not know", () => {
		expect(themePreferenceForValue(99)).toBe("system");
		expect(themePreferenceForValue(-1)).toBe("system");
	});

	// Renumbering would silently repaint every device that already stored one.
	it("keeps system at zero, so an unwritten setting means follow the device", () => {
		expect(valueForThemePreference("system")).toBe(0);
	});
});

describe("useApplyThemePreference", () => {
	it("pushes the stored scheme into uniwind", async () => {
		stored.colorScheme = valueForThemePreference("dark");

		const { getByTestId } = await render(<Probe />);

		expect(mockSetTheme).toHaveBeenCalledWith("dark");
		expect(getByTestId("preference").props.children).toBe("dark");
	});

	it("follows the device when nothing has been stored", async () => {
		await render(<Probe />);

		expect(mockSetTheme).toHaveBeenCalledWith("system");
	});
});
