import { CATALOGS, EN } from "@/i18n/catalog";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";

/**
 * Every date name this module renders comes from the catalog, so there is one
 * localized set rather than a table per call site. The lookup stays hook-free on
 * purpose: the widget payload, the Spotlight index and the notification body all
 * format dates outside React, so the language has to arrive as a value.
 *
 * It defaults to the live language rather than to English — a call site that has
 * not been migrated to pass one still renders in the user's language, which is
 * the failure mode that let six English tables accumulate in the first place.
 */
function dateName(key: string, language: Language, params?: Readonly<Record<string, string | number>>): string {
	return translate(key, {
		catalog: CATALOGS[language] ?? EN,
		fallback: EN,
		params,
	});
}

/** `firstWeekday` is 1 = Sunday, 2 = Monday; `firstDayOfMonth` is 1–28. */
export interface CalendarSettings {
	firstDayOfMonth: number;
	firstWeekday: number;
}

/** Matches `SETTING_DEFAULTS`. */
export const DEFAULT_CALENDAR: CalendarSettings = {
	firstDayOfMonth: 1,
	firstWeekday: 1,
};

/** Local-calendar midnight of the given instant. */
export function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** First local instant of the given instant's month. */
export function firstOfMonth(date: Date): Date {
	const d = new Date(date);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Midnight on the most recent `firstWeekday` (1 = Sunday, 2 = Monday — the
 * `firstWeekday` setting's own encoding). Defaults to Sunday, which is what the
 * setting defaults to.
 */
export function startOfWeek(date: Date, firstWeekday = 1): Date {
	const d = startOfDay(date);
	const offset = (d.getDay() - (firstWeekday - 1) + 7) % 7;
	d.setDate(d.getDate() - offset);
	return d;
}

/** Mirrors Swift's `getStartOfMonth`. */
export function monthPeriodStart(date: Date, firstDayOfMonth = 1): Date {
	const anchor = Math.min(Math.max(1, firstDayOfMonth), 28);
	const start = startOfDay(date);
	if (start.getDate() < anchor) {
		start.setMonth(start.getMonth() - 1);
	}
	start.setDate(anchor);
	return start;
}

export function startOfYear(date: Date): Date {
	const d = new Date(date);
	d.setMonth(0, 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Adds `n` days keeping local wall time (DST-tolerant, like Calendar `.day`). */
export function addDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

/**
 * Adds `n` calendar months. Insights bucketing only ever calls this on a
 * first-of-month anchor, so no month-length clamping is needed — the day stays 1.
 */
export function addMonths(date: Date, n: number): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + n);
	return d;
}

/** Short month as the language writes it, e.g. "Jul" / "jul". */
export function monthAbbrevTitle(date: Date, language: Language = runtimeLanguage()): string {
	return dateName(`dates.month.${date.getMonth()}`, language);
}

/** The shouted short month the Log and Insights headers use, e.g. "JUL". */
export function monthAbbrev(date: Date, language: Language = runtimeLanguage()): string {
	return monthAbbrevTitle(date, language).toUpperCase();
}

/** Single-letter weekday for the week chart's axis, e.g. "M". */
export function weekdayInitial(date: Date, language: Language = runtimeLanguage()): string {
	return dateName(`dates.weekdayInitial.${date.getDay()}`, language);
}

export function isFuture(date: Date, now: Date = new Date()): boolean {
	return date.getTime() > now.getTime();
}

/**
 * Uppercased section header, per Swift's `dateConverter`: TODAY / YESTERDAY /
 * "FRI, 24 JUL" — and "FRI, 24 JUL '25" once the day falls before the current
 * year.
 */
export function formatDayHeader(day: Date, now: Date = new Date(), language: Language = runtimeLanguage()): string {
	const today = startOfDay(now).getTime();
	const target = startOfDay(day).getTime();
	const oneDay = 86_400_000;
	if (target === today) {
		return dateName("common.today", language).toUpperCase();
	}
	if (target === today - oneDay) {
		return dateName("common.yesterday", language).toUpperCase();
	}
	const weekday = dateName(`dates.weekday.${day.getDay()}`, language).toUpperCase();
	const base = `${weekday}, ${day.getDate()} ${monthAbbrev(day, language)}`;
	return day.getFullYear() < now.getFullYear() ? `${base} '${String(day.getFullYear()).slice(-2)}` : base;
}

/**
 * A charge the schedule has not made yet, e.g. "Sat, 7 Nov" — and "Sun, 7 Feb
 * 2027" once it leaves the current year, which a yearly cadence does on its
 * first step. Title case rather than `formatDayHeader`'s shout: this reads as a
 * list of dates, not as a section the ledger is divided into.
 */
export function formatChargeDate(date: Date, now: Date = new Date(), language: Language = runtimeLanguage()): string {
	const weekday = dateName(`dates.weekday.${date.getDay()}`, language);
	const base = `${weekday}, ${date.getDate()} ${monthAbbrevTitle(date, language)}`;
	return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** "24 JUL", per Swift's `dateFormatter`. */
export function formatUpcomingDate(date: Date, language: Language = runtimeLanguage()): string {
	return `${date.getDate()} ${monthAbbrev(date, language)}`;
}

/**
 * "9:04 PM" on a 12-hour clock, "21:04" on a 24-hour one. The 24-hour form pads
 * the hour because that is how every locale that uses it writes the small hours;
 * the 12-hour form must not, or "9:04 PM" becomes "09:04 PM".
 */
export function formatTime(date: Date, use24Hour = false, language: Language = runtimeLanguage()): string {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const mm = minutes < 10 ? `0${minutes}` : String(minutes);
	if (use24Hour) {
		return `${hours < 10 ? `0${hours}` : hours}:${mm}`;
	}
	const meridiem = dateName(hours >= 12 ? "dates.meridiem.pm" : "dates.meridiem.am", language);
	const hour12 = hours % 12 === 0 ? 12 : hours % 12;
	return `${hour12}:${mm} ${meridiem}`;
}

/** The shouted full month a budget's limit picker names, e.g. "JULY". */
export function formatMonthLabel(date: Date, language: Language = runtimeLanguage()): string {
	return dateName(`dates.monthLong.${date.getMonth()}`, language).toUpperCase();
}
