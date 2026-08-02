import type { ReactNode } from "react";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Uniwind, useUniwind } from "uniwind";

import {
	persistThemePreference,
	readThemePreference,
	type ThemePreference,
} from "@/theme/theme-preference";

type ThemeName = "light" | "dark";

interface AppThemeContextType {
	currentTheme: string;
	isDark: boolean;
	/** False until the persisted preference has been read and applied. */
	isHydrated: boolean;
	isLight: boolean;
	setTheme: (theme: ThemeName) => void;
	setThemePreference: (preference: ThemePreference) => void;
	themePreference: ThemePreference;
	toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(
	undefined,
);

/**
 * The root layout holds the splash on `isHydrated`, so a dark-mode user never
 * sees a frame of the system light theme. `readThemePreference` swallows its own
 * failures, so this always settles.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
	const { theme, hasAdaptiveThemes } = useUniwind();
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		let cancelled = false;
		readThemePreference().then((preference) => {
			if (!cancelled) {
				Uniwind.setTheme(preference);
				setIsHydrated(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const isLight = useMemo(() => theme === "light", [theme]);
	const isDark = useMemo(() => theme === "dark", [theme]);
	const themePreference: ThemePreference = hasAdaptiveThemes ? "system" : theme;

	const setThemePreference = useCallback((preference: ThemePreference) => {
		Uniwind.setTheme(preference);
		persistThemePreference(preference);
	}, []);

	const setTheme = useCallback(
		(newTheme: ThemeName) => {
			setThemePreference(newTheme);
		},
		[setThemePreference],
	);

	const toggleTheme = useCallback(() => {
		setThemePreference(theme === "light" ? "dark" : "light");
	}, [theme, setThemePreference]);

	const value = useMemo(
		() => ({
			currentTheme: theme,
			isHydrated,
			isLight,
			isDark,
			themePreference,
			setTheme,
			setThemePreference,
			toggleTheme,
		}),
		[
			theme,
			isHydrated,
			isLight,
			isDark,
			themePreference,
			setTheme,
			setThemePreference,
			toggleTheme,
		],
	);

	return (
		<AppThemeContext.Provider value={value}>
			{children}
		</AppThemeContext.Provider>
	);
}

export function useAppTheme() {
	const context = use(AppThemeContext);
	if (!context) {
		throw new Error("useAppTheme must be used within AppThemeProvider");
	}
	return context;
}
