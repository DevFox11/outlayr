import type { SettingsSnapshot } from "./settings";

export interface DisplaySettings {
    showCents: boolean;
    swapTimeLabel: boolean;
    use24Hour: boolean;
}

export function selectDisplaySettings(snapshot: SettingsSnapshot): DisplaySettings {
    return {
        showCents: snapshot.bool("showCents"),
        swapTimeLabel: snapshot.bool("swapTimeLabel"),
        use24Hour: snapshot.bool("use24HourClock"),
    };
}
