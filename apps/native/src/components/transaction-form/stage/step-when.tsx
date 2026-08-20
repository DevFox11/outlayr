import { addDays, formatSentenceDate, startOfDay } from "@/domain/dates";
import { useLanguage, useTranslation } from "@/i18n/context";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

type WhenOptionId = "chosen" | "pick" | "today" | "yesterday";

/**
 * The named day at the clock time the entry already carries. Naming a day is not
 * a reason to reset the time, which is stored with the row.
 */
function atSameTime(day: Date, source: Date): Date {
    const next = startOfDay(day);
    next.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
    return next;
}

interface StepWhenProps {
    /** The date the entry carries. One that is neither today nor yesterday appears as its own option. */
    date: Date;
    /** Names today; the host already holds a clock, and a test pins it. */
    now: Date;
    /** Opens the host's date picker — the stage has no calendar of its own. */
    onPick: () => void;
    onSelect: (date: Date) => void;
    /**
     * Labels the option that opens the picker. Defaults to the form's own "Date"
     * field label, the nearest string that exists; a host with a better key
     * passes it here rather than this file minting copy.
     */
    pickLabel?: string;
}

/** The stage's date step: today, yesterday, whatever else is already chosen, and the picker. */
export function StepWhen({ date, now, onPick, onSelect, pickLabel }: StepWhenProps) {
    const t = useTranslation();
    const { language } = useLanguage();

    const today = startOfDay(now);
    const yesterday = addDays(today, -1);
    const chosen = startOfDay(date).getTime();
    const isToday = chosen === today.getTime();
    const isYesterday = chosen === yesterday.getTime();

    const options: StageOptionItem<WhenOptionId>[] = [
        { id: "today", label: t("transaction.sentence.when.today") },
        { id: "yesterday", label: t("transaction.sentence.when.yesterday") },
    ];
    // A date the two quick options cannot state still has to read as the
    // selection, and tapping it is the way back into the picker.
    if (!(isToday || isYesterday)) {
        options.push({ id: "chosen", label: formatSentenceDate(date, language) });
    }
    options.push({ id: "pick", label: pickLabel ?? t("transaction.field.date") });

    const pick = (id: WhenOptionId) => {
        if (id === "today") {
            onSelect(atSameTime(today, date));
            return;
        }
        if (id === "yesterday") {
            onSelect(atSameTime(yesterday, date));
            return;
        }
        onPick();
    };

    const selectedId = (): WhenOptionId | null => {
        if (isToday) {
            return "today";
        }
        return isYesterday ? "yesterday" : "chosen";
    };

    return <StageOptionRow onSelect={pick} options={options} selectedId={selectedId()} />;
}
