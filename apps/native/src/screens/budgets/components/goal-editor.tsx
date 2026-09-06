import { DatePicker, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import ArrowRight01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowRight01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { MonoLabel } from "@/components/mono-label";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useNow } from "@/data/use-now";
import { formatTargetDate } from "@/domain/dates";
import { tomorrowLocal } from "@/domain/local-day";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

/** What the editor writes. Every field is optional: one row commits one fact. */
export interface GoalEdit {
    name?: string;
    targetAmount?: number;
    targetDate?: Date;
}

interface GoalEditorProps {
    accountName: string;
    currency: string;
    /** The currency `targetAmount` is actually in — the goal's own when unvalued. */
    targetCurrency: string;
    /** The currency the goal was set in, when it is not the one being read. */
    foreignCurrency?: string | null;
    /** What the target costs a month at today's standing, or null once reached. */
    perMonth: number | null;
    onChange: (edit: GoalEdit) => void;
    /** Opens the target sheet: the amount is placed, not typed into a row. */
    onChangeTarget: () => void;
    onDelete: () => void;
    name: string;
    targetAmount: number;
    targetDate: Date;
}

/**
 * A goal's facts, edited where they are read.
 *
 * There is no save and no form: each row commits on its own and the figures
 * above it move as it does. The account is not a row at all — progress IS that
 * account's balance, so swapping it would silently restate every figure the goal
 * has ever shown; it is stated with the reason instead.
 */
export function GoalEditor({
    accountName,
    currency,
    foreignCurrency,
    name,
    onChange,
    onChangeTarget,
    onDelete,
    perMonth,
    targetAmount,
    targetCurrency,
    targetDate,
}: GoalEditorProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const [pickingDate, setPickingDate] = useState(false);
    const [naming, setNaming] = useState(false);

    const money = (value: number) => formatAmount(value, currency, showCents, language);

    // Tomorrow at the earliest, for the reason the sheet has the same floor: a
    // goal due today has no month left to hold a pace over. Keyed on the shared
    // clock, or a screen left open across midnight would keep yesterday's idea of
    // tomorrow — which is today, and would let a same-day deadline through the
    // floor that exists to refuse it.
    const nowMs = useNow();
    const range = useMemo(() => {
        const start = tomorrowLocal(nowMs);
        return { start: start < targetDate ? start : targetDate };
    }, [targetDate, nowMs]);

    const commitName = (next: string) => {
        setNaming(false);
        if (next.trim() && next.trim() !== name.trim()) {
            onChange({ name: next.trim() });
        }
    };

    return (
        <View className="pt-7">
            <MonoLabel>{t("goals.editor.title")}</MonoLabel>
            <View className="border-border mt-2 border-t">
                {naming ? (
                    <Animated.View className="border-border border-b py-2.5" entering={revealEntering()}>
                        <TextInput
                            autoCapitalize="words"
                            autoFocus
                            className="text-body text-foreground py-1 font-sans"
                            defaultValue={name}
                            // `onEndEditing` rather than `onSubmitEditing`: it fires on Done
                            // and on a blur, and a name typed then abandoned by tapping the
                            // next row is still a name the user typed.
                            onEndEditing={(event) => commitName(event.nativeEvent.text)}
                            placeholder={t("goals.form.defaultName")}
                            placeholderTextColorClassName="accent-muted"
                            returnKeyType="done"
                        />
                    </Animated.View>
                ) : (
                    <EditorRow label={t("goals.editor.name")} onPress={() => setNaming(true)} value={name} />
                )}

                <EditorRow
                    detail={perMonth == null ? null : t("goals.editor.targetNote", { amount: money(perMonth) })}
                    label={t("goals.editor.target")}
                    onPress={onChangeTarget}
                    // In the goal's OWN currency when the conversion is unavailable:
                    // the figure handed down is then the stored face amount, and
                    // labelling it with the display currency would say EUR 1,000 is
                    // GBP 1,000 on a screen already saying there is no rate.
                    value={formatAmount(targetAmount, targetCurrency, showCents, language)}
                />

                <EditorRow
                    label={t("goals.editor.by")}
                    onPress={() => setPickingDate((open) => !open)}
                    value={formatTargetDate(targetDate, language)}
                />
                {pickingDate ? (
                    <Animated.View className="border-border border-b py-2" entering={revealEntering()}>
                        <Host style={{ height: 40 }}>
                            <HStack>
                                <DatePicker
                                    displayedComponents={["date"]}
                                    modifiers={[datePickerStyle("compact"), labelsHidden()]}
                                    // Clamped, not merely bounded: an overdue goal
                                    // lowers the range's floor to its own past date
                                    // so the picker can render it, which would
                                    // otherwise let any day since be chosen afresh.
                                    onDateChange={(next) => {
                                        setPickingDate(false);
                                        const floor = tomorrowLocal(nowMs);
                                        onChange({ targetDate: next < floor ? floor : next });
                                    }}
                                    range={range}
                                    selection={targetDate}
                                />
                                <Spacer />
                            </HStack>
                        </Host>
                    </Animated.View>
                ) : null}

                <View className="border-border border-b py-3.5">
                    <View className="flex-row items-center gap-3">
                        <Text className="text-body text-foreground flex-1">{t("goals.editor.account")}</Text>
                        <Text className="text-body text-muted">{accountName}</Text>
                    </View>
                    <Text className="text-muted text-subtitle pt-1 leading-snug">{t("goals.editor.accountNote")}</Text>
                </View>

                <Pressable
                    accessibilityRole="button"
                    className="border-border border-b py-3.5 active:opacity-60"
                    onPress={onDelete}
                >
                    <Text className="text-over-budget text-body">{t("goals.editor.delete")}</Text>
                </Pressable>
            </View>

            {foreignCurrency ? (
                <Text className="text-muted text-subtitle pt-2 leading-snug">
                    {t("goals.editor.currency", { from: foreignCurrency, to: currency })}
                </Text>
            ) : null}
        </View>
    );
}

function EditorRow({
    label,
    value,
    detail,
    onPress,
}: {
    detail?: ReactNode;
    label: string;
    onPress: () => void;
    value: string;
}) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityValue={{ text: value }}
            className="border-border border-b py-3.5 active:opacity-60"
            onPress={onPress}
        >
            <View className="flex-row items-center gap-3">
                <Text className="text-body text-foreground flex-1">{label}</Text>
                <Text className="text-body text-muted" style={{ fontVariant: ["tabular-nums"] }}>
                    {value}
                </Text>
                <HugeiconsIcon color={colors.subtle} icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
            </View>
            {detail ? <Text className="text-muted text-subtitle pt-1 leading-snug">{detail}</Text> : null}
        </Pressable>
    );
}
