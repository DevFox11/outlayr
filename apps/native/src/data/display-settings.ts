import type { SettingsSnapshot } from "./settings";

export interface DisplaySettings {
	showCents: boolean;
	use24Hour: boolean;
	swapTimeLabel: boolean;
}

export function selectDisplaySettings(
	snapshot: SettingsSnapshot,
): DisplaySettings {
	return {
		showCents: snapshot.bool("showCents"),
		use24Hour: snapshot.bool("use24HourClock"),
		swapTimeLabel: snapshot.bool("swapTimeLabel"),
	};
}
