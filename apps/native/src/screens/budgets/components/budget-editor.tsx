import { DatePicker, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import { datePickerStyle, frame, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import { useMemo, useState } from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { MonoLabel } from "@/components/mono-label";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { BUDGET_TYPE, budgetPeriodName, budgetWindowLabel, periodEnd, startOfPeriod } from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

import { EditorRow } from "./editor-row";

/**
 * What the editor writes. Every field is optional: one row commits one fact.
 *
 * `amount` is not one of the editor's own rows — the limit is set on the sheet —
 * but it travels the same write, so the screen has one place to handle a failure.
 */
export interface BudgetEdit {
    amount?: number;
    name?: string | null;
    rollover?: boolean;
    startDate?: Date;
    type?: number;
}

interface BudgetEditorProps {
    calendar: { firstDayOfMonth: number; firstWeekday: number };
    /** Signed, and already in the display currency. Zero when nothing carried in. */
    carry: number;
    currency: string;
    /** The currency the limit was stored in, when it is not today's. */
    foreignCurrency?: string | null;
    /** The target this window runs on: the limit plus whatever carried in. */
    amount: number;
    /** The limit as set, before anything carried into it. */
    limit: number;
    nowMs: number;
    name: string | null;
    /** Shown greyed in the name field: the category's own name, or Everything. */
    namePlaceholder: string;
    onChange: (edit: BudgetEdit) => void;
    onChangeLimit: () => void;
    rollover: boolean;
    startDate: Date;
    type: number;
}

const PERIODS = [BUDGET_TYPE.day, BUDGET_TYPE.week, BUDGET_TYPE.month, BUDGET_TYPE.year] as const;

/**
 * A budget's facts, edited where they are read.
 *
 * There is no save: each row commits on its own, and the figures above it move
 * as it does. That is the point of editing here rather than in a modal — you
 * change the limit standing in front of the number it governs.
 */
export function BudgetEditor({
    amount,
    limit,
    calendar,
    carry,
    nowMs,
    currency,
    foreignCurrency,
    name,
    namePlaceholder,
    rollover,
    startDate,
    type,
    onChange,
    onChangeLimit,
}: BudgetEditorProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const haptics = useHaptics();
    const { showCents } = useDisplaySettings().state;
    const colors = useColors();
    const [pickingPeriod, setPickingPeriod] = useState(false);
    const [pickingDate, setPickingDate] = useState(false);
    const [naming, setNaming] = useState(false);

    const money = (value: number) => formatAmount(value, currency, showCents, language);
    // Stated only where it changes what the window runs on. Carry is signed, so
    // "with -40 carried in" is an overspend still being paid off.
    const carryNote =
        carry === 0 ? null : t("budgets.editor.limitCarry", { amount: money(amount), carry: money(carry) });

    // Deliberately leaves the chips open: the note under them states the window
    // the change just produced, and closing over it would hide the consequence at
    // the moment it lands.
    /** Blank restores the category's own name, which is what `customName` stores. */
    const commitName = (next: string) => {
        setNaming(false);
        if (next.trim() !== (name ?? "").trim()) {
            onChange({ name: next });
        }
    };

    const changePeriod = (next: number) => {
        haptics("selection");
        if (next !== type) {
            onChange({ type: next });
        }
    };

    // The window the chosen cadence produces, which is the current one for that
    // cadence — see `budgetPatch`, which re-anchors rather than keeping a date
    // that describes a different rhythm.
    // The window rolls forward from the anchor, so a future date leaves the budget
    // reporting a window it is not in yet and ignoring everything spent until then.
    // The deleted form capped the picker at today; this keeps that, and keeps an
    // anchor already older than the current period selectable so an edit elsewhere
    // does not silently move it.
    const anchorRange = useMemo(() => {
        const now = new Date(nowMs);
        const periodStart = startOfPeriod(now, type, calendar);
        return { end: now, start: startDate.getTime() < periodStart.getTime() ? startDate : periodStart };
    }, [nowMs, type, calendar, startDate]);

    const preview = (next: number) => {
        const start = startOfPeriod(new Date(nowMs), next, calendar);
        return budgetWindowLabel({ end: periodEnd(start, next), start }, next, language);
    };

    return (
        <View className="pt-7">
            <MonoLabel>{t("budgets.editor.title")}</MonoLabel>
            <View className="border-border mt-2 border-t">
                <EditorRow
                    detail={carryNote}
                    label={t("budgets.editor.limit")}
                    onPress={onChangeLimit}
                    value={money(limit)}
                />

                <EditorRow
                    label={t("budgets.editor.every")}
                    onPress={() => setPickingPeriod((open) => !open)}
                    value={t(budgetPeriodName(type))}
                />
                {pickingPeriod ? (
                    <Animated.View className="border-border gap-3 border-b pb-4" entering={revealEntering()}>
                        <View className="flex-row flex-wrap gap-2">
                            {PERIODS.map((period) => (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: period === type }}
                                    className={cn(
                                        "h-[38px] items-center justify-center rounded-[19px] border px-3.5",
                                        period === type ? "border-tint bg-tint/10" : "border-border"
                                    )}
                                    key={period}
                                    onPress={() => changePeriod(period)}
                                >
                                    <Text
                                        className={cn(
                                            "text-subtitle",
                                            period === type ? "text-tint" : "text-foreground"
                                        )}
                                    >
                                        {t(budgetPeriodName(period))}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text className="text-footnote text-muted leading-snug">
                            {t("budgets.editor.reslice", { window: preview(type) })}
                        </Text>
                    </Animated.View>
                ) : null}

                <EditorRow
                    label={t("budgets.editor.from")}
                    onPress={() => setPickingDate((open) => !open)}
                    // Day-shaped on purpose: this row is the anchor, one date, not the
                    // span the anchor produces.
                    value={budgetWindowLabel({ end: startDate, start: startDate }, BUDGET_TYPE.day, language)}
                />
                {pickingDate ? (
                    <Animated.View className="border-border border-b py-2" entering={revealEntering()}>
                        <Host style={{ height: 40 }}>
                            <HStack modifiers={[frame({ maxHeight: Number.POSITIVE_INFINITY })]}>
                                <DatePicker
                                    displayedComponents={["date"]}
                                    modifiers={[datePickerStyle("compact"), labelsHidden()]}
                                    range={anchorRange}
                                    onDateChange={(next) => {
                                        setPickingDate(false);
                                        onChange({ startDate: next });
                                    }}
                                    selection={startDate}
                                />
                                <Spacer />
                            </HStack>
                        </Host>
                    </Animated.View>
                ) : null}

                <View className="border-border border-b py-3.5">
                    <View className="flex-row items-center gap-3">
                        <Text className="text-body text-foreground flex-1">{t("budgets.editor.carry")}</Text>
                        <Switch
                            accessibilityLabel={t("budgets.editor.carry")}
                            onValueChange={(next) => onChange({ rollover: next })}
                            trackColor={{ false: colors.subtle, true: colors.income }}
                            value={rollover}
                        />
                    </View>
                    <Text className="text-muted text-subtitle pt-1 leading-snug">
                        {rollover && carry !== 0
                            ? t("budgets.editor.dropCarry", { carry: money(carry) })
                            : t("budgets.editor.carryNote")}
                    </Text>
                </View>

                {naming ? (
                    <Animated.View className="border-border border-b py-2.5" entering={revealEntering()}>
                        <TextInput
                            autoCapitalize="words"
                            autoFocus
                            className="text-body text-foreground py-1 font-sans"
                            defaultValue={name ?? ""}
                            // `onEndEditing` rather than `onSubmitEditing`: it fires on Done
                            // AND on a blur, and a name typed then abandoned by tapping the
                            // next row is still a name the user typed. Blurring without it
                            // dropped the text silently, which no other row here does.
                            onEndEditing={(event) => commitName(event.nativeEvent.text)}
                            placeholder={namePlaceholder}
                            placeholderTextColorClassName="accent-muted"
                            returnKeyType="done"
                        />
                        <Text className="text-muted text-subtitle pt-1 leading-snug">
                            {t("budgets.editor.nameNote")}
                        </Text>
                    </Animated.View>
                ) : (
                    <EditorRow
                        label={t("budgets.editor.name")}
                        onPress={() => setNaming(true)}
                        value={name?.trim() ? name : namePlaceholder}
                    />
                )}
            </View>

            {foreignCurrency ? (
                <Text className="text-muted text-subtitle pt-2 leading-snug">
                    {t("budgets.editor.currency", { from: foreignCurrency, to: currency })}
                </Text>
            ) : null}
        </View>
    );
}
