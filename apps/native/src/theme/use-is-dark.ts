import { useTheme } from "panelui-native/theme";

/**
 * Whether the app is painting dark right now.
 *
 * Not `useColorScheme` from react-native. The colour scheme is a stored
 * setting that {@link useApplyThemePreference} pushes into uniwind, and uniwind
 * resolves it in memory without ever touching RN's `Appearance` — so on a phone
 * left in Light with "Dark" chosen in Settings, `useColorScheme` still answers
 * `"light"` while every pixel on screen is dark.
 */
export function useIsDark(): boolean {
    return useTheme().theme === "dark";
}
