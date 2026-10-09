import { addDays, addMonths, firstOfMonth, startOfDay, startOfWeek } from "@outlayr/money/calendar";

import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";

import { monthAbbrevTitle } from "./dates";

export type CursorUnit = "day" | "week" | "month";

/**
 * The Log fetches a day on an exact `day` value and a week or month on its first
 * instant, so a cursor that isn't normalized quietly returns nothing at all.
 */
export function cursorStart(unit: CursorUnit, date: Date, firstWeekday = 1): Date {
    switch (unit) {
        case "day": {
            return startOfDay(date);
        }
        case "week": {
            return startOfWeek(date, firstWeekday);
        }
        case "month": {
            return firstOfMonth(date);
        }
        default: {
            const unhandled: never = unit;
            throw new Error(`Unhandled cursor unit: ${String(unhandled)}`);
        }
    }
}

/** The first instant *after* the unit the cursor names. */
export function cursorEnd(unit: CursorUnit, date: Date, firstWeekday = 1): Date {
    const start = cursorStart(unit, date, firstWeekday);
    switch (unit) {
        case "day": {
            return addDays(start, 1);
        }
        case "week": {
            return addDays(start, 7);
        }
        case "month": {
            return addMonths(start, 1);
        }
        default: {
            const unhandled: never = unit;
            throw new Error(`Unhandled cursor unit: ${String(unhandled)}`);
        }
    }
}

export function stepCursor(unit: CursorUnit, date: Date, count: number, firstWeekday = 1): Date {
    const start = cursorStart(unit, date, firstWeekday);
    const moved = unit === "month" ? addMonths(start, count) : addDays(start, count * (unit === "week" ? 7 : 1));
    return cursorStart(unit, moved, firstWeekday);
}

/** False once the next step would land in the future — nothing is logged there. */
export function canStepForward(unit: CursorUnit, date: Date, now: Date, firstWeekday = 1): boolean {
    return stepCursor(unit, date, 1, firstWeekday).getTime() <= now.getTime();
}

/** "25 Jul 2026" / "19 Jul – 25 Jul" / "Jul 2026", per Swift's `Unit.dateFormat`. */
export function cursorLabel(
    unit: CursorUnit,
    date: Date,
    firstWeekday = 1,
    language: Language = runtimeLanguage()
): string {
    const start = cursorStart(unit, date, firstWeekday);
    const month = monthAbbrevTitle(start, language);
    switch (unit) {
        case "day": {
            return `${start.getDate()} ${month} ${start.getFullYear()}`;
        }
        case "month": {
            return `${month} ${start.getFullYear()}`;
        }
        case "week": {
            const end = addDays(start, 6);
            return `${start.getDate()} ${month} – ${end.getDate()} ${monthAbbrevTitle(end, language)}`;
        }
        default: {
            const unhandled: never = unit;
            throw new Error(`Unhandled cursor unit: ${String(unhandled)}`);
        }
    }
}
