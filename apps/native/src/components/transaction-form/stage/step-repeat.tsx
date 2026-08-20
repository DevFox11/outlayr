import { Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { formatSentenceDate } from "@/domain/dates";
import { SELECTABLE_RECURRING_TYPES } from "@/domain/recurrence";
import { cadenceLabel, leadLabel } from "@/domain/transaction-form-labels";
import { useLanguage, useTranslation } from "@/i18n/context";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

/** The schedule line's face. 20/32 has no token pair — `text-title` is 20/26. */
const LINE = "font-sans-medium text-[20px] leading-[32px]";

/**
 * This face and the sentence's 26/38 both leave 12pt of leading, so the rule
 * clears the descenders at the offset the sentence measured.
 */
const RULE_BOTTOM = 7;

/**
 * The leads the stage offers, as the design names them. `REMINDER_LEAD_OPTIONS`
 * also carries three days, which this row leaves out — a lead outside the list
 * is appended rather than dropped, so a subscription restored from another
 * device never renders a row with nothing selected.
 */
const LEAD_OPTIONS: readonly (number | null)[] = [null, 0, 1, 2, 7];

const CUSTOM_OPTION = "custom";

const LEAD_OFF_OPTION = "off";

/** Null is the one lead with no number to name it. */
const leadOptionId = (lead: number | null): string => (lead === null ? LEAD_OFF_OPTION : String(lead));

interface ScheduleValueProps {
    onPress: () => void;
    value: string;
}

/**
 * A settled value on the schedule line, drawn as the sentence draws its own.
 * Not `SentenceValue`: that one reads its face out of `useSentenceStyle` and
 * renders only inside a `<Sentence>`, and this line is neither.
 */
function ScheduleValue({ onPress, value }: ScheduleValueProps) {
    return (
        <Pressable accessibilityLabel={value} accessibilityRole="button" onPress={onPress}>
            <Text className={`${LINE} text-foreground`}>{value}</Text>
            <View
                className="bg-tint absolute right-0 left-0 h-[2px] rounded-full"
                pointerEvents="none"
                style={{ bottom: RULE_BOTTOM }}
            />
        </Pressable>
    );
}

interface StepRepeatProps {
    /** The stored `recurringType`; `RECURRING_TYPE.none` leaves the row unselected. */
    cadence: number;
    /** The host's own interval is in force, which is what "custom" states. */
    custom?: boolean;
    /** Names that interval — an "every 3 weeks" phrase — in place of the plain "Custom…". */
    customLabel?: string;
    /** Null while the schedule runs forever. */
    endDate: Date | null;
    /**
     * The two words the line reads around its values. No catalog key states them
     * yet, so they arrive from the host rather than being minted here.
     */
    labels: { ending: string; starting: string };
    /** Days ahead of a charge; null is off. */
    leadDays: number | null;
    onCadenceChange: (type: number) => void;
    /** Opens the host's interval sheet. */
    onCustomPress: () => void;
    onEndDatePress: () => void;
    onLeadChange: (lead: number | null) => void;
    onStartDatePress: () => void;
    startDate: Date;
}

/**
 * The stage's repeat step. States the whole schedule in the sentence's own
 * vocabulary — options and one running line — rather than the grouped rows the
 * sentence replaced.
 */
export function StepRepeat({
    cadence,
    custom = false,
    customLabel,
    endDate,
    labels,
    leadDays,
    onCadenceChange,
    onCustomPress,
    onEndDatePress,
    onLeadChange,
    onStartDatePress,
    startDate,
}: StepRepeatProps) {
    const t = useTranslation();
    const { language } = useLanguage();

    const cadences: StageOptionItem<string>[] = SELECTABLE_RECURRING_TYPES.map((type) => ({
        // The id is the stored `recurringType` as a string; `CUSTOM_OPTION` is
        // the host's own interval, which has no type of its own.
        id: String(type),
        label: cadenceLabel(t, type),
    }));
    cadences.push({ id: CUSTOM_OPTION, label: customLabel ?? t("transaction.schedule.customOption") });

    const pickCadence = (id: string) => {
        if (id === CUSTOM_OPTION) {
            onCustomPress();
            return;
        }
        onCadenceChange(Number(id));
    };

    const leads = LEAD_OPTIONS.includes(leadDays) ? LEAD_OPTIONS : [...LEAD_OPTIONS, leadDays];
    const leadOptions: StageOptionItem<string>[] = leads.map((lead) => ({
        id: leadOptionId(lead),
        label: leadLabel(t, lead),
    }));

    const pickLead = (id: string) => {
        onLeadChange(id === LEAD_OFF_OPTION ? null : Number(id));
    };

    return (
        <View className="gap-4">
            <StageOptionRow
                onSelect={pickCadence}
                options={cadences}
                selectedId={custom ? CUSTOM_OPTION : String(cadence)}
            />

            {/* The comma and the full stop are punctuation rather than copy: both
                languages this app ships write the line the same way around the two
                words the host passes in. */}
            <View className="flex-row flex-wrap items-baseline" testID="stage-repeat-line">
                <Text className={`${LINE} text-grammar`}>{`${labels.starting} `}</Text>
                <ScheduleValue onPress={onStartDatePress} value={formatSentenceDate(startDate, language)} />
                <Text className={`${LINE} text-grammar`}>{`, ${labels.ending} `}</Text>
                <ScheduleValue
                    onPress={onEndDatePress}
                    value={endDate === null ? t("common.never") : formatSentenceDate(endDate, language)}
                />
                <Text className={`${LINE} text-grammar`}>.</Text>
            </View>

            <View className="gap-2.5">
                <Text className="text-footnote text-muted">{t("transaction.field.remind")}</Text>
                <StageOptionRow onSelect={pickLead} options={leadOptions} selectedId={leadOptionId(leadDays)} />
            </View>
        </View>
    );
}
