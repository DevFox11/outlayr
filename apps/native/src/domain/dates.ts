import { addDays, startOfDay } from "@outlayr/money/calendar";

import { CATALOGS, EN } from "@/i18n/catalog";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";

import { daysBetween } from "./local-day";

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

/**
 * A chart tick for a `YYYY-MM-DD` key, e.g. "7 Jul". Noon keeps the key's
 * calendar day whatever the zone offset.
 */
export function formatDayMonth(dateKey: string, language: Language = runtimeLanguage()): string {
    const date = new Date(`${dateKey}T12:00:00`);
    return `${date.getDate()} ${monthAbbrevTitle(date, language)}`;
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

/**
 * Uppercased section header, per Swift's `dateConverter`: TODAY / YESTERDAY /
 * "FRI, 24 JUL" — and "FRI, 24 JUL '25" once the day falls before the current
 * year.
 */
export function formatDayHeader(day: Date, now: Date = new Date(), language: Language = runtimeLanguage()): string {
    const today = startOfDay(now).getTime();
    const target = startOfDay(day).getTime();
    if (target === today) {
        return dateName("common.today", language).toUpperCase();
    }
    if (target === startOfDay(addDays(now, -1)).getTime()) {
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

export function dueDay(date: Date, from: Date, language: Language = runtimeLanguage()) {
    const days = daysBetween(startOfDay(from).getTime(), startOfDay(date).getTime());
    if (days === 0) {
        return { days, name: dateName("common.today", language) };
    }
    if (days === 1) {
        return { days, name: dateName("common.tomorrow", language) };
    }
    const name =
        days > 1 && days < 7
            ? dateName(`dates.weekdayLong.${date.getDay()}`, language)
            : formatChargeDate(date, from, language);
    return { days, name };
}

export function formatDueDay(date: Date, from: Date, language: Language = runtimeLanguage()): string {
    const { name } = dueDay(date, from, language);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export function formatWeekdayDay(date: Date, language: Language = runtimeLanguage()): string {
    return `${dateName(`dates.weekday.${date.getDay()}`, language)} ${date.getDate()}`;
}

/** "24 JUL", per Swift's `dateFormatter`. */
export function formatUpcomingDate(date: Date, language: Language = runtimeLanguage()): string {
    return `${date.getDate()} ${monthAbbrev(date, language)}`;
}

/** "24 Jul" — {@link formatUpcomingDate} for somewhere a shout would be read as one. */
export function formatSentenceDate(date: Date, language: Language = runtimeLanguage()): string {
    return `${date.getDate()} ${monthAbbrevTitle(date, language)}`;
}

/**
 * "9:04 PM" on a 12-hour clock, "21:04" on a 24-hour one. The 24-hour form pads
 * the hour because that is how every locale that uses it writes the small hours;
 * the 12-hour form must not, or "9:04 PM" becomes "09:04 PM".
 */
export function formatTime(date: Date, use24Hour = false, language: Language = runtimeLanguage()): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const mm = String(minutes).padStart(2, "0");
    if (use24Hour) {
        return `${String(hours).padStart(2, "0")}:${mm}`;
    }
    const meridiem = dateName(hours >= 12 ? "dates.meridiem.pm" : "dates.meridiem.am", language);
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${mm} ${meridiem}`;
}

/** The full month as the language writes it, e.g. "July" / "julio". */
export function monthLongTitle(date: Date, language: Language = runtimeLanguage()): string {
    return dateName(`dates.monthLong.${date.getMonth()}`, language);
}

/**
 * "Jun 2027" — a goal's deadline, which is months or years out.
 *
 * The year is not optional the way it is on a transaction date: a target is
 * chosen precisely because it is far away, and "24 Jun" would read as this year.
 */
export function formatTargetMonth(date: Date, language: Language = runtimeLanguage()): string {
    return `${monthAbbrevTitle(date, language)} ${date.getFullYear()}`;
}

/** "30 Jun 2027" — {@link formatTargetMonth} where the chosen day itself matters. */
export function formatTargetDate(date: Date, language: Language = runtimeLanguage()): string {
    return `${date.getDate()} ${formatTargetMonth(date, language)}`;
}
