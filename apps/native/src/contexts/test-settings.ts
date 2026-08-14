import type { AppSettingsValue, DisplaySettingsValue } from "@/contexts/display-settings-context";
import type { DisplaySettings } from "@/data/display-settings";
import type { SettingsSnapshot } from "@/data/settings";
import type { BoolSettingKey, NumberSettingKey } from "@/data/settings-core";

/*
 * Deliberately free of runtime imports. `jest.mock` factories are hoisted above
 * the importing module, so a fixture these factories call must not read a value
 * out of another module — several of the suites using it mock
 * `@/data/settings-core`, and reaching for `SETTING_DEFAULTS` from here resolves
 * to their mock and yields `undefined`. The values below restate the three
 * display defaults from that file; the type imports are erased and safe.
 */

/**
 * A complete {@link DisplaySettings} for a `useDisplaySettings` mock, with
 * `overrides` applied over the shipped defaults.
 *
 * Test-only. `AppSettingsProvider` reads these from `appMeta`, so a suite that
 * renders a formatter without a database mocks the hook. Returning only the flag
 * under test leaves the mock's return type incomplete — pass it as an override.
 */
export const testDisplaySettings = (overrides: Partial<DisplaySettings> = {}): DisplaySettings => ({
    showCents: true,
    swapTimeLabel: false,
    use24Hour: false,
    ...overrides,
});

/** {@link testDisplaySettings} shaped as the context value the hook returns. */
export const testDisplaySettingsValue = (overrides: Partial<DisplaySettings> = {}): DisplaySettingsValue => ({
    state: testDisplaySettings(overrides),
});

/**
 * A complete {@link SettingsSnapshot} for a `useAppSettings` mock. Unlisted keys
 * read as `false` / `0` rather than as their shipped default — a suite that
 * cares about a setting names it.
 */
export const testSettingsSnapshot = (
    bool: Partial<Record<BoolSettingKey, boolean>> = {},
    number: Partial<Record<NumberSettingKey, number>> = {}
): SettingsSnapshot => ({
    bool: (key) => bool[key] ?? false,
    number: (key) => number[key] ?? 0,
});

/**
 * A complete {@link AppSettingsValue} for a `useAppSettings` mock. `state` takes
 * the readers the test cares about — usually a spy standing in for `bool` or
 * `number` — over a default snapshot, and `actions` defaults to inert writers.
 */
export const testAppSettings = (
    state: Partial<SettingsSnapshot> = {},
    actions: Partial<AppSettingsValue["actions"]> = {}
): AppSettingsValue => ({
    actions: {
        setBool: () => {
            // a test that asserts on a write passes its own spy
        },
        setNumber: () => {
            // as above
        },
        ...actions,
    },
    state: { ...testSettingsSnapshot(), ...state },
});
