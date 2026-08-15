import { DatePicker, Host, HStack, Spacer, Toggle } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { Pressable, TextInput, Vibration, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { AmountEntrySheet } from "@/components/amount-entry-sheet";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { useCategoryPickerField } from "@/components/form/category-picker-field";
import { InlineFailure } from "@/components/form/inline-failure";
import { useNumpadAmountField } from "@/components/form/numpad-amount-field";
import { holdSubmitting, pressSubmit } from "@/components/form/submit-guard";
import { MonoLabel } from "@/components/mono-label";
import { SegmentedControl } from "@/components/segmented-control";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { budgetsRepo } from "@/data/budgets";
import type { Budget } from "@/data/budgets";
import { getCategoryById } from "@/data/categories-core";
import type { Database } from "@/db/client";
import { BUDGET_TYPE, startOfPeriod } from "@/domain/budget-math";
import { minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

type Kind = "overall" | "category";
type Period = "day" | "week" | "month" | "year";

/**
 * Named so the two union fields keep their union type. Inferred from the initial
 * object they would each narrow to the one literal the current mode happens to
 * start on, and the segmented controls below set the other.
 */
interface BudgetFormValues {
    amount: string;
    category: ReturnType<typeof getCategoryById>;
    kind: Kind;
    name: string;
    period: Period;
    rollover: boolean;
    startDate: Date | null;
}

const PERIOD_TYPE = {
    day: BUDGET_TYPE.day,
    month: BUDGET_TYPE.month,
    week: BUDGET_TYPE.week,
    year: BUDGET_TYPE.year,
} satisfies Record<Period, number>;

interface BudgetFormProps {
    db: Database;
    /**
     * The row an edit re-writes. Its kind is fixed: a per-category budget cannot
     * become the overall singleton without orphaning its own row.
     */
    initial?: Budget;
    onDone: () => void;
}

// Keyed by a stored budget `type`, which is a plain column value.
const PERIOD_BY_TYPE = new Map<number, Period>([
    [BUDGET_TYPE.day, "day"],
    [BUDGET_TYPE.week, "week"],
    [BUDGET_TYPE.month, "month"],
    [BUDGET_TYPE.year, "year"],
]);

/** Overall budgets are a singleton — saving re-points the existing one. */
export function BudgetForm({ db, onDone, initial }: BudgetFormProps) {
    const t = useTranslation();
    const currency = useGlobalCurrency(db);
    const minorUnits = minorUnitsFor(currency);
    const { state: settings } = useAppSettings();
    const calendar = useMemo(
        () => ({
            firstDayOfMonth: settings.number("firstDayOfMonth"),
            firstWeekday: settings.number("firstWeekday"),
        }),
        [settings]
    );

    const colors = useColors();
    const [missingCategory, setMissingCategory] = useState(false);
    /** This screen is a `modal` and stays up on failure, so the notice is inline. */
    const [saveFailure, setSaveFailure] = useState<string | null>(null);

    const shakeX = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.get() }],
    }));

    const shake = () => {
        shakeX.set(
            withSequence(
                withTiming(-8, { duration: 45 }),
                withTiming(8, { duration: 45 }),
                withTiming(-6, { duration: 45 }),
                withTiming(0, { duration: 45 })
            )
        );
    };

    const [initialValues] = useState<BudgetFormValues>(() => ({
        amount: initial ? numberToNumpad(initial.amount, minorUnits) : "",
        category: initial?.categoryId ? getCategoryById(db, initial.categoryId) : null,
        kind: initial ? "category" : "overall",
        name: initial?.name ?? "",
        period: initial ? (PERIOD_BY_TYPE.get(initial.type) ?? "month") : "month",
        rollover: initial?.rollover ?? false,
        startDate: initial?.startDate ?? null,
    }));

    const form = useForm({
        defaultValues: initialValues,
        onSubmit: async ({ value }) => {
            setSaveFailure(null);
            const amountNumber = numpadToNumber(value.amount);
            if (amountNumber <= 0) {
                return;
            }
            const type = PERIOD_TYPE[value.period];
            if (value.kind === "category" && !value.category) {
                setMissingCategory(true);
                shake();
                Vibration.vibrate(40);
                return;
            }
            try {
                if (initial) {
                    if (value.category) {
                        await budgetsRepo.updateBudget(db, initial.id, {
                            amount: amountNumber,
                            categoryId: value.category.id,
                            name: value.name,
                            rollover: value.rollover,
                            startDate: value.startDate,
                            type,
                        });
                    }
                } else if (value.kind === "overall") {
                    await budgetsRepo.createMainBudget(db, {
                        amount: amountNumber,
                        name: value.name,
                        rollover: value.rollover,
                        startDate: value.startDate,
                        type,
                    });
                } else if (value.category) {
                    await budgetsRepo.createBudget(db, {
                        amount: amountNumber,
                        categoryId: value.category.id,
                        name: value.name,
                        rollover: value.rollover,
                        startDate: value.startDate,
                        type,
                    });
                }
                onDone();
                return await holdSubmitting();
            } catch (error) {
                console.error("Failed to save budget", error);
                setSaveFailure(t("budgets.save.failedBody"));
            }
        },
    });

    const { kind, category, amount, name, period, startDate, rollover } = useSelector(form.store, (s) => s.values);
    const isSubmitting = useSelector(form.store, (s) => s.isSubmitting);

    const amountField = useNumpadAmountField({
        code: currency,
        minorUnits,
        onChange: (next) => form.setFieldValue("amount", next),
        value: amount,
    });
    const {
        present: presentCategoryPicker,
        ref: categoryPickerRef,
        select: selectCategory,
    } = useCategoryPickerField((picked) => {
        form.setFieldValue("category", picked);
        setMissingCategory(false);
    });

    const amountNumber = amountField.amount;
    const canSave = amountNumber > 0 && (kind === "overall" || category != null) && !isSubmitting;
    const defaultName =
        kind === "overall" ? t("budgets.form.defaultOverall") : (category?.name ?? t("budgets.form.defaultName"));

    // Untouched, the picker shows the anchor the repo would pick anyway.
    const periodStart = useMemo(() => startOfPeriod(new Date(), PERIOD_TYPE[period], calendar), [period, calendar]);
    // The window rolls forward from the stored anchor, so an older date is lost —
    // except one an existing budget already runs on, which the picker must be
    // able to show or SwiftUI clamps the selection out from under the edit.
    const backdateRange = useMemo(() => {
        const anchor = initial?.startDate;
        const start = anchor && anchor.getTime() < periodStart.getTime() ? anchor : periodStart;
        return { end: new Date(), start };
    }, [periodStart, initial]);

    return (
        <View className="bg-background flex-1">
            <KeyboardAwareScrollView
                bottomOffset={24}
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
                keyboardShouldPersistTaps="handled"
            >
                {initial ? null : (
                    <SegmentedControl
                        // SAFETY: the control reports one of the `options` below, which are
                        // exactly `Kind`'s members.
                        onChange={(next) => form.setFieldValue("kind", next as Kind)}
                        options={[
                            { label: t("budgets.form.kindOverall"), value: "overall" },
                            { label: t("budgets.form.kindCategory"), value: "category" },
                        ]}
                        value={kind}
                    />
                )}

                <Pressable
                    accessibilityLabel={t("budgets.form.amountA11y")}
                    accessibilityRole="button"
                    className="items-center py-8 active:opacity-70"
                    onPress={amountField.present}
                >
                    <HeroNumber
                        amount={amountNumber}
                        code={currency}
                        sign=""
                        size={52}
                        toneClass={amountNumber > 0 ? "text-foreground" : "text-subtle"}
                    />
                </Pressable>

                <Field label={t("budgets.form.name")}>
                    <TextInput
                        autoCapitalize="words"
                        className="border-border text-body text-foreground rounded-xl border px-3 py-3 font-sans"
                        onChangeText={(next) => form.setFieldValue("name", next)}
                        placeholder={defaultName}
                        placeholderTextColorClassName="accent-muted"
                        returnKeyType="done"
                        value={name}
                    />
                </Field>

                {kind === "category" ? (
                    <Field label={t("budgets.form.category")}>
                        <Animated.View style={shakeStyle}>
                            <Pressable
                                accessibilityRole="button"
                                className={cn(
                                    "flex-row items-center gap-3 rounded-xl border px-3 py-3 active:opacity-70",
                                    missingCategory ? "border-danger" : "border-border"
                                )}
                                onPress={presentCategoryPicker}
                            >
                                {category ? (
                                    <>
                                        <CategoryIconTile
                                            color={category.color ?? "#767676"}
                                            emoji={category.emoji}
                                            icon={category.icon}
                                            size={28}
                                        />
                                        <Text className="text-body text-foreground flex-1">{category.name}</Text>
                                    </>
                                ) : (
                                    <Text className="text-body text-muted flex-1">
                                        {t("budgets.form.selectCategory")}
                                    </Text>
                                )}
                                <Text className="text-headline text-subtle">›</Text>
                            </Pressable>
                        </Animated.View>
                    </Field>
                ) : null}

                <Field label={t("budgets.form.period")}>
                    <SegmentedControl
                        // SAFETY: the control reports one of the `options` below, which are
                        // exactly `Period`'s members.
                        onChange={(next) => form.setFieldValue("period", next as Period)}
                        options={[
                            { label: t("budgets.form.periodDay"), value: "day" },
                            { label: t("budgets.form.periodWeek"), value: "week" },
                            { label: t("budgets.form.periodMonth"), value: "month" },
                            { label: t("budgets.form.periodYear"), value: "year" },
                        ]}
                        value={period}
                    />
                </Field>

                <Field label={t("budgets.form.starts")}>
                    <Host style={{ height: 40 }}>
                        <HStack>
                            <DatePicker
                                displayedComponents={["date"]}
                                modifiers={[datePickerStyle("compact"), labelsHidden()]}
                                onDateChange={(next) => form.setFieldValue("startDate", next)}
                                range={backdateRange}
                                selection={startDate ?? periodStart}
                            />
                            <Spacer />
                        </HStack>
                    </Host>
                </Field>

                <Field label={t("budgets.form.rollover")}>
                    <Host style={{ height: 40 }}>
                        <HStack>
                            <Toggle
                                isOn={rollover}
                                modifiers={[tint(colors.income), labelsHidden()]}
                                onIsOnChange={(next) => form.setFieldValue("rollover", next)}
                            />
                            <Spacer />
                        </HStack>
                    </Host>
                    <Text className="text-footnote text-muted pt-1 leading-snug">{t("budgets.form.rolloverNote")}</Text>
                </Field>

                <View className="mt-4">
                    <InlineFailure message={saveFailure} />
                </View>

                <Pressable
                    accessibilityRole="button"
                    className={cn(
                        "items-center rounded-xl py-3.5",
                        canSave ? "bg-accent active:opacity-80" : "bg-surface"
                    )}
                    disabled={!canSave}
                    onPress={() => pressSubmit(form)}
                >
                    <Text
                        className={cn(
                            "font-sans-semibold text-body",
                            canSave ? "text-accent-foreground" : "text-subtle"
                        )}
                    >
                        {initial ? t("budgets.form.save") : t("budgets.form.create")}
                    </Text>
                </Pressable>
            </KeyboardAwareScrollView>

            <AmountEntrySheet {...amountField.sheetProps} />
            <CategoryPickerSheet
                db={db}
                income={false}
                onSelect={selectCategory}
                ref={categoryPickerRef}
                selectedId={category?.id ?? null}
            />
        </View>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View className="mb-4">
            <View className="mb-2">
                <MonoLabel>{label}</MonoLabel>
            </View>
            {children}
        </View>
    );
}
