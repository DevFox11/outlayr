import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import type { ThemePreference } from "./theme-preference";
import { useThemePreference } from "./use-theme-preference";

const mockState = { theme: "light", hasAdaptiveThemes: false };
const mockSetTheme = jest.fn();

jest.mock("uniwind", () => ({
	useUniwind: () => mockState,
}));

jest.mock("panelui-native", () => ({
	useTheme: () => ({ theme: mockState.theme, setTheme: mockSetTheme }),
}));

function Probe({ press }: { press?: ThemePreference }) {
	const { preference, setPreference } = useThemePreference();
	return (
		<Pressable
			onPress={() => {
				if (press) {
					setPreference(press);
				}
			}}
			testID="probe"
		>
			<Text testID="preference">{preference}</Text>
		</Pressable>
	);
}

async function mount(theme: string, hasAdaptiveThemes: boolean) {
	mockState.theme = theme;
	mockState.hasAdaptiveThemes = hasAdaptiveThemes;
	return await render(<Probe press="dark" />);
}

beforeEach(() => {
	mockSetTheme.mockClear();
});

describe("useThemePreference", () => {
	it("reports 'system' while Uniwind follows the device, whatever it resolved to", async () => {
		const { getByTestId } = await mount("dark", true);
		expect(getByTestId("preference").props.children).toBe("system");
	});

	it("reports the pinned theme once the device is no longer being followed", async () => {
		const dark = await mount("dark", false);
		expect(dark.getByTestId("preference").props.children).toBe("dark");

		const light = await mount("light", false);
		expect(light.getByTestId("preference").props.children).toBe("light");
	});

	it("passes the chosen preference to PanelUI unchanged", async () => {
		const { getByTestId } = await mount("light", true);
		fireEvent.press(getByTestId("probe"));
		expect(mockSetTheme).toHaveBeenCalledWith("dark");
	});
});
