import { startOfDay } from "@outlayr/money/calendar";
import { utcDateString } from "@outlayr/money/dates";

import { formatSentenceDate, formatTime } from "@/domain/dates";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

const DAY_MS = 86_400_000;

interface RateAgeInput {
    entryDate: Date;
    fetchedAt: number | null;
    language: Language;
    now: Date;
    rateDate: string | null;
    use24Hour: boolean;
}

export interface RateAge {
    detail: string;
    stale: boolean;
}

function dayParts(key: string): [number, number, number] {
    const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
    return [year, month - 1, day];
}

export function rateAge(t: TranslateFn, input: RateAgeInput): RateAge {
    const { entryDate, fetchedAt, language, now, rateDate, use24Hour } = input;
    if (rateDate === null) {
        return { detail: t("transaction.rate.asOf", { date: formatSentenceDate(entryDate, language) }), stale: false };
    }
    const rateDay = new Date(...dayParts(rateDate));
    const entryKey = utcDateString(entryDate.getTime());
    const daysOld = Math.round((Date.UTC(...dayParts(entryKey)) - Date.UTC(...dayParts(rateDate))) / DAY_MS);
    if (daysOld > 0) {
        return {
            detail: t("transaction.rate.daysOld", { count: daysOld, date: formatSentenceDate(rateDay, language) }),
            stale: true,
        };
    }
    const fetched = fetchedAt === null ? null : new Date(fetchedAt);
    if (fetched !== null && startOfDay(fetched).getTime() === startOfDay(now).getTime()) {
        return {
            detail: t("transaction.rate.asOfTime", { time: formatTime(fetched, use24Hour, language) }),
            stale: false,
        };
    }
    return { detail: t("transaction.rate.asOf", { date: formatSentenceDate(rateDay, language) }), stale: false };
}
