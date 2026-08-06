import { useTheme } from "panelui-native";
import { useUniwind } from "uniwind";

import type { ThemePreference } from "./theme-preference";

function toPreference(
	theme: string,
	hasAdaptiveThemes: boolean,
): ThemePreference {
	if (hasAdaptiveThemes) {
		return "system";
	}
	return theme === "dark" ? "dark" : "light";
}

/**
 * PanelUI's `useTheme` reports the resolved theme, so `"system"` is only
 * readable through Uniwind's `hasAdaptiveThemes` — which `Uniwind.setTheme`
 * sets when it is handed `"system"`.
 */
export function useThemePreference(): {
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => void;
} {
	const { theme, setTheme } = useTheme();
	const { hasAdaptiveThemes } = useUniwind();

	return {
		preference: toPreference(theme, hasAdaptiveThemes),
		setPreference: setTheme,
	};
}
