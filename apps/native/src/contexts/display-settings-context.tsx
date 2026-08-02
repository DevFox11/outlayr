import { createContext, type ReactNode, use, useMemo } from "react";
import {
	type DisplaySettings,
	selectDisplaySettings,
} from "@/data/display-settings";
import {
	type BoolSettingKey,
	type NumberSettingKey,
	type SettingsSnapshot,
	setBoolSetting,
	setNumberSetting,
	useAllSettings,
} from "@/data/settings";
import { useLocalData } from "./local-data-context";

interface DisplaySettingsValue {
	state: DisplaySettings;
}

interface AppSettingsValue {
	state: SettingsSnapshot;
	actions: {
		setBool: (key: BoolSettingKey, value: boolean) => void;
		setNumber: (key: NumberSettingKey, value: number) => void;
	};
}

const OUTSIDE_PROVIDER =
	"useDisplaySettings and useAppSettings must be used within AppSettingsProvider";

const DisplaySettingsContext = createContext<DisplaySettingsValue | null>(null);
const AppSettingsContext = createContext<AppSettingsValue | null>(null);

/**
 * One `useAllSettings` subscription for the whole tree, split into two
 * contexts: `DisplaySettingsContext`'s memo is keyed on the four primitive
 * booleans, so its published value stays referentially stable across an
 * unrelated `appMeta` write — `AppSettingsContext`'s is keyed on the whole
 * snapshot and re-renders on every write, same as today.
 */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
	const { db } = useLocalData();
	const settings = useAllSettings(db);
	const { showCents, showSign, use24Hour, swapTimeLabel } =
		selectDisplaySettings(settings);

	const displayValue = useMemo<DisplaySettingsValue>(
		() => ({ state: { showCents, showSign, use24Hour, swapTimeLabel } }),
		[showCents, showSign, use24Hour, swapTimeLabel],
	);

	const appValue = useMemo<AppSettingsValue>(
		() => ({
			state: settings,
			actions: {
				setBool: (key, value) => {
					if (db == null) {
						return;
					}
					void setBoolSetting(db, key, value);
				},
				setNumber: (key, value) => {
					if (db == null) {
						return;
					}
					void setNumberSetting(db, key, value);
				},
			},
		}),
		[settings, db],
	);

	return (
		<AppSettingsContext.Provider value={appValue}>
			<DisplaySettingsContext.Provider value={displayValue}>
				{children}
			</DisplaySettingsContext.Provider>
		</AppSettingsContext.Provider>
	);
}

export function useDisplaySettings(): DisplaySettingsValue {
	const value = use(DisplaySettingsContext);
	if (value == null) {
		throw new Error(OUTSIDE_PROVIDER);
	}
	return value;
}

export function useAppSettings(): AppSettingsValue {
	const value = use(AppSettingsContext);
	if (value == null) {
		throw new Error(OUTSIDE_PROVIDER);
	}
	return value;
}
