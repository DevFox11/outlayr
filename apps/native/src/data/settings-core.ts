import type { Database } from "@/db/client";
import type { TranslationKey } from "@/i18n";
import type { Language } from "@/i18n/languages";
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
	// The subscription due-date notices. Its own key rather than a second reading
	// of `showNotifications`: the permission-revoke reconcile writes that one back
	// off, and sharing it would take the daily reminder's switch down with it.
	| "subscriptionReminders"
	| "categorySuggestions"
	| "aiEnrichment"
	// Swaps a Log row's time label for its category. No Settings row writes it
	// yet, so it always resolves to the default.
	| "swapTimeLabel"
	// Swift's `DefaultsKey.confetti`: throws confetti over a newly created
	// transaction.
	| "confetti"
	// Swift's `DefaultsKey.budgetViewStyle`: true lists the budgets as rows,
	// false as a two-up card grid. Swift defaulted to the grid; the Grid design
	// pass made rows the shipped list here, so the default is inverted.
	| "budgetViewStyle"
	// Renders every logged time as "21:04" rather than "9:04 PM". Unlike
	// `firstWeekday` there is no faithful static default — the honest one is
	// whatever the handset already shows — so `seedClockPreference` writes the
	// device's value once, and `SETTING_DEFAULTS` only carries a value because
	// the key must satisfy the record constraint.
	| "use24HourClock";
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
	| "insightsMeasure"
	// Swift's `notificationOption`: 1 = morning, 2 = evening, 3 = the stored
	// `notificationHour`/`notificationMinute`. Only read when `showNotifications`
	// is on.
	| "notificationOption"
	| "notificationHour"
	| "notificationMinute";

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
	subscriptionReminders: false,
	categorySuggestions: true,
	aiEnrichment: true,
	swapTimeLabel: false,
	confetti: false,
	budgetViewStyle: true,
	use24HourClock: false,
	insightsTimeFrame: 1,
	insightsMeasure: 1,
	firstWeekday: 1,
	firstDayOfMonth: 1,
	numberEntryType: 2,
	haptics: 1,
	logInsightsTimeFrame: 2,
	logInsightsType: 1,
	notificationOption: 1,
	notificationHour: 8,
	notificationMinute: 0,
} as const satisfies Record<
	BoolSettingKey | NumberSettingKey,
	boolean | number
>;

export const HAPTICS_OPTIONS = [
	{ label: "settings.haptics.none", value: 0 },
	{ label: "settings.haptics.subtle", value: 1 },
	{ label: "settings.haptics.excessive", value: 2 },
] as const satisfies readonly { label: TranslationKey; value: number }[];

export function numberEntryLabel(type: number): TranslationKey {
	return type === 1
		? "settings.numberEntry.type1"
		: "settings.numberEntry.type2";
}

/** Null where no option owns the value, as the empty label used to signal. */
export function hapticsLabel(value: number): TranslationKey | null {
	return (
		HAPTICS_OPTIONS.find((option) => option.value === value)?.label ?? null
	);
}

export function onOffLabel(value: boolean): TranslationKey {
	return value ? "common.on" : "common.off";
}

export function shownHiddenLabel(value: boolean): TranslationKey {
	return value ? "common.shown" : "common.hidden";
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

/**
 * Writes the handset's own 12/24-hour convention, and only while the user has
 * never expressed one — the same shape as the deferred currency seeding, where
 * a device value may fill an empty setting but must never overrule a stored
 * choice. Absence is the whole signal here, so this reads the raw row rather
 * than `readBoolSetting`, which cannot tell "false" from "never written".
 */
export async function seedClockPreference(
	db: Database,
	deviceUses24Hour: boolean,
): Promise<void> {
	if ((await getMeta(db, "use24HourClock")) != null) {
		return;
	}
	await setBoolSetting(db, "use24HourClock", deviceUses24Hour);
}

export function clockLabel(use24Hour: boolean): TranslationKey {
	return use24Hour ? "clock.twentyFourHour" : "clock.twelveHour";
}

export function weekdayLabel(firstWeekday: number): TranslationKey {
	return firstWeekday === 2 ? "settings.time.monday" : "settings.time.sunday";
}

export function ordinalDay(day: number, language: Language = "en"): string {
	// Spanish counts days of the month with plain cardinals ("día 3 del mes"),
	// so an English ordinal suffix would render as "día 3rd del mes".
	if (language !== "en") {
		return String(day);
	}
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
