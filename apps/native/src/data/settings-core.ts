import type { Database } from "@/db/client";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";

/**
 * Values persist as strings: "true"/"false" for booleans, decimal for integers.
 * Currency lives under `META_KEYS.currency`; theme is not a setting here at all
 * (AsyncStorage, via `app-theme-context`).
 */
export type BoolSettingKey =
	| "showCents"
	| "showExpenseOrIncomeSign"
	| "incomeTracking"
	| "animatedCharts"
	| "showUpcoming"
	// Swift's `showUpcomingTransactionsWhenUpcoming`: clips the Upcoming section
	// to entries landing inside the next two weeks.
	| "showUpcomingSoon"
	// Draws the hero's sparkline.
	| "logViewLineGraph"
	| "biometricLock"
	| "showNotifications"
	| "categorySuggestions"
	// Swaps a Log row's time label for its category. No Settings row writes it
	// yet, so it always resolves to the default.
	| "swapTimeLabel";
export type NumberSettingKey =
	| "firstWeekday"
	| "firstDayOfMonth"
	| "numberEntryType"
	| "haptics"
	// The Log header's own two choices. Persisted rather than held in screen
	// state: they survive a relaunch, and the widget reads the same keys.
	| "logInsightsTimeFrame"
	| "logInsightsType"
	// The Insights tab's own period, Swift's `chartTimeFrame`: 1 = week,
	// 2 = month, 3 = year.
	| "insightsTimeFrame"
	// Which figure the Insights hero leads with: 1 = spent, 2 = income, 3 = net.
	| "insightsMeasure";

/**
 * Mirrors the Swift app's `DefaultsKey` seeds. `firstWeekday`: 1 = Sunday,
 * 2 = Monday. `firstDayOfMonth`: day-of-month 1–28. `logInsightsTimeFrame`:
 * 2 = this week. `logInsightsType`: 1 = net. `insightsTimeFrame`: 1 = week.
 */
export const SETTING_DEFAULTS = {
	showCents: true,
	showExpenseOrIncomeSign: true,
	incomeTracking: true,
	animatedCharts: true,
	showUpcoming: true,
	showUpcomingSoon: false,
	logViewLineGraph: false,
	biometricLock: false,
	showNotifications: false,
	categorySuggestions: true,
	swapTimeLabel: false,
	insightsTimeFrame: 1,
	insightsMeasure: 1,
	firstWeekday: 1,
	firstDayOfMonth: 1,
	numberEntryType: 2,
	haptics: 1,
	logInsightsTimeFrame: 2,
	logInsightsType: 1,
} as const satisfies Record<
	BoolSettingKey | NumberSettingKey,
	boolean | number
>;

export const HAPTICS_OPTIONS = [
	{ label: "None", value: 0 },
	{ label: "Subtle", value: 1 },
	{ label: "Excessive", value: 2 },
] as const;

export function numberEntryLabel(type: number): string {
	return type === 1 ? "Type 1" : "Type 2";
}

export function hapticsLabel(value: number): string {
	return HAPTICS_OPTIONS.find((option) => option.value === value)?.label ?? "";
}

export function onOffLabel(value: boolean): string {
	return value ? "On" : "Off";
}

export function shownHiddenLabel(value: boolean): string {
	return value ? "Shown" : "Hidden";
}

export function parseBoolSetting(
	raw: string | null,
	fallback: boolean,
): boolean {
	if (raw == null) {
		return fallback;
	}
	return raw === "true";
}

export function parseIntSetting(raw: string | null, fallback: number): number {
	if (raw == null) {
		return fallback;
	}
	const value = Number.parseInt(raw, 10);
	return Number.isNaN(value) ? fallback : value;
}

export async function readBoolSetting(
	db: Database,
	key: BoolSettingKey,
): Promise<boolean> {
	return parseBoolSetting(await getMeta(db, key), SETTING_DEFAULTS[key]);
}

export async function readNumberSetting(
	db: Database,
	key: NumberSettingKey,
): Promise<number> {
	return parseIntSetting(await getMeta(db, key), SETTING_DEFAULTS[key]);
}

export async function setBoolSetting(
	db: Database,
	key: BoolSettingKey,
	value: boolean,
): Promise<void> {
	await setMeta(db, key, value ? "true" : "false");
}

export async function setNumberSetting(
	db: Database,
	key: NumberSettingKey,
	value: number,
): Promise<void> {
	await setMeta(db, key, String(value));
}

/**
 * The "chosen" marker is written second on purpose: a crash between the two
 * leaves a currency nothing claims the user chose, which is the harmless
 * direction — `stampLedgerCurrency` then declines rather than freezing rows
 * against it.
 */
export async function setCurrency(db: Database, code: string): Promise<void> {
	await setMeta(db, META_KEYS.currency, code);
	await setMeta(db, META_KEYS.currencyChosen, "true");
}

export function weekdayLabel(firstWeekday: number): string {
	return firstWeekday === 2 ? "Monday" : "Sunday";
}

export function ordinalDay(day: number): string {
	const mod100 = day % 100;
	const mod10 = day % 10;
	let suffix = "th";
	if (mod100 < 11 || mod100 > 13) {
		if (mod10 === 1) {
			suffix = "st";
		} else if (mod10 === 2) {
			suffix = "nd";
		} else if (mod10 === 3) {
			suffix = "rd";
		}
	}
	return `${day}${suffix}`;
}
