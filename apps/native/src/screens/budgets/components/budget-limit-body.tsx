import type { ExpenseContribution } from "@outlayr/money/budget-spent";
import { lastMsBefore, spentForCategory, spentForMain } from "@outlayr/money/budget-spent";
import { BUDGET_TYPE, periodEnd, startOfPeriod } from "@outlayr/money/budget-window";
import type { BudgetWindow } from "@outlayr/money/budget-window";
import { useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AmountNumpad } from "@/components/amount-numpad";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { Sentence } from "@/components/sentence/sentence";
import { revealEntering } from "@/components/sentence/sentence-motion";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { earliestDate } from "@/data/budgets";
import { buildBurndown } from "@/domain/budget-burndown";
import { suggestedLimit } from "@/domain/budget-limit-step";
import { budgetPeriodCadence, budgetPeriodName, budgetWindowLabel } from "@/domain/budget-math";
import { typicalSpend } from "@/domain/budget-typical";
import { monthLongTitle } from "@/domain/dates";
import { formatAmount, minorUnitsFor } from "@/domain/money";
import { numberToNumpad, numpadToNumber } from "@/domain/numpad";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

import { BudgetLimitPicker } from "./budget-limit-picker";
import { SheetCommitButton } from "./sheet-commit-button";

/** The scope a limit is being placed on. A null `categoryId` is the whole ledger. */
export interface LimitTarget {
    categoryId: string | null;
    color?: string | null;
    emoji?: string | null;
    icon?: string | null;
    /** The limit as it stands, or null when there is none yet. */
    limit: number | null;
    name: string;
    /** True when committing re-points the one overall budget rather than adding one. */
    replacesExisting?: boolean;
    type: number;
    /** The window the budget runs on. Recomputed from today when the period changes. */
    window?: BudgetWindow | null;
}

export interface LimitCommit {
    /** The figure on the sheet. Always the one a budget being created takes. */
    limit: number;
    /**
     * False when the figure was never touched. An existing limit must then stand
     * as stored: what is on screen is that limit *converted* into the ledger's
     * currency, and writing it back would restate a EUR 100 budget as USD 111.
     */
    limitChanged: boolean;
    type: number;
}

interface BudgetLimitBodyProps {
    calendar: { firstDayOfMonth: number; firstWeekday: number };
    contributions: readonly ExpenseContribution[];
    currency: string;
    nowMs: number;
    /** Awaited, so the button can hold while the write it starts is in flight. */
    onCommit: (commit: LimitCommit) => Promise<void> | void;
    /** Off on the first-run takeover, which has one scope and one cadence. */
    periodChoice?: boolean;
    target: LimitTarget;
}

const PERIODS = [BUDGET_TYPE.day, BUDGET_TYPE.week, BUDGET_TYPE.month, BUDGET_TYPE.year] as const;

/** Smaller than a transaction's sentence: this one states two facts, not seven. */
const STATED = "font-sans-medium text-[19px] leading-[28px] tracking-tight text-grammar";

/**
 * Setting one limit, stated and then placed.
 *
 * The head says what the budget will be, the figure is the limit, and the plot
 * under it is what the scope actually costs — the answer to whether the figure
 * is a sane one, which is the question a bare number field cannot ask. Shared by
 * the sheet and by the first-run takeover, which is the same decision with the
 * scope already known.
 */
export function BudgetLimitBody({
    target,
    contributions,
    currency,
    nowMs,
    calendar,
    periodChoice = true,
    onCommit,
}: BudgetLimitBodyProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const haptics = useHaptics();
    const money = (value: number) => formatAmount(value, currency, false, language);
    const [type, setType] = useState(target.type);
    const [pickingPeriod, setPickingPeriod] = useState(false);
    const [typing, setTyping] = useState(false);
    const minorUnits = minorUnitsFor(currency);

    // The stored window while the period is untouched, so an edit opens on the
    // window the budget is actually running; a fresh one once it changes, because
    // the old anchor no longer describes the cadence being chosen.
    const window = useMemo(() => {
        if (type === target.type && target.window) {
            return target.window;
        }
        const start = startOfPeriod(new Date(nowMs), type, calendar);
        return { end: periodEnd(start, type), start };
    }, [type, target.type, target.window, nowMs, calendar]);

    const spentIn = useMemo(() => {
        const { categoryId } = target;
        return categoryId
            ? (start: Date, end: Date) => spentForCategory(contributions, categoryId, start, lastMsBefore(end))
            : (start: Date, end: Date) => spentForMain(contributions, start, lastMsBefore(end));
    }, [contributions, target]);

    // `since` bounds the walk at the ledger's own first expense. Without it a
    // two-month-old ledger still reports on "the last 6", four of which never
    // existed — the zeros do not move the median, but they do dress a thin sample
    // as a verdict.
    const since = useMemo(() => earliestDate(contributions), [contributions]);
    const evidence = useMemo(
        () => typicalSpend({ current: window, since, spentIn, type }),
        [window, since, spentIn, type]
    );

    const burndown = useMemo(
        () =>
            buildBurndown(contributions, {
                categoryId: target.categoryId,
                limit: 0,
                now: new Date(nowMs),
                window,
            }),
        [contributions, target.categoryId, nowMs, window]
    );

    const sampleSize = useMemo(
        () =>
            contributions.filter(
                (row) =>
                    row.date.getTime() >= window.start.getTime() &&
                    row.date.getTime() <= nowMs &&
                    (target.categoryId === null ||
                        row.categoryId === target.categoryId ||
                        row.parentId === target.categoryId)
            ).length,
        [contributions, window, nowMs, target.categoryId]
    );

    // Opens on the stored limit, else on what the scope usually costs, else on
    // four fifths of this window — a figure the curve already crosses, so the
    // first thing the plot says is something rather than nothing. A scope with a
    // history is the common case; a first-run ledger has only the window.
    const [opening] = useState(
        () => target.limit ?? evidence.typical ?? suggestedLimit(burndown.points.at(-1)?.spent ?? 0)
    );
    const [limit, setLimit] = useState(opening);
    const [entry, setEntry] = useState(() => numberToNumpad(opening, minorUnits));

    /**
     * A write in flight, not a write already made. `createMainBudget` reads before
     * it inserts and `mainBudget` has no singleton constraint, so two presses
     * landing before the first returns would each see no overall budget and insert
     * one — and the sheet stays on screen for the length of its dismissal, which
     * is long enough to tap twice.
     *
     * Released when the call settles rather than latched: the first-run takeover
     * renders this body inline and stays mounted through a failed write, and a
     * latch there would swallow every retry.
     */
    const inFlight = useRef(false);

    const commit = async () => {
        if (limit <= 0) {
            setTyping(true);
            return;
        }
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        const write = async () => onCommit({ limit, limitChanged: limit !== target.limit, type });
        await write().finally(() => {
            inFlight.current = false;
        });
    };

    const typeLimit = (next: string) => {
        setEntry(next);
        setLimit(numpadToNumber(next));
    };

    const dragLimit = (next: number) => {
        setLimit(next);
        setEntry(numberToNumpad(next, minorUnits));
    };

    const periodPhrase = t(budgetPeriodCadence(type));
    // The month's own name only when the window IS that month: an anchor on the
    // 15th makes "August" a lie about a window that ends in September.
    const windowLabel =
        type === BUDGET_TYPE.month && window.start.getDate() === 1
            ? monthLongTitle(window.start, language)
            : budgetWindowLabel(window, type, language);

    return (
        <View>
            <View className="px-5">
                <Sentence
                    slots={{
                        period: (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ expanded: pickingPeriod }}
                                disabled={!periodChoice}
                                onPress={() => setPickingPeriod((open) => !open)}
                            >
                                <Text
                                    className={cn(
                                        STATED,
                                        periodChoice ? "text-tint" : "text-foreground",
                                        periodChoice && "border-tint border-b-[1.5px]"
                                    )}
                                >
                                    {periodPhrase}
                                </Text>
                            </Pressable>
                        ),
                        scope: (
                            <View className="flex-row items-center gap-1.5">
                                {target.categoryId ? (
                                    <CategoryIconTile
                                        color={target.color ?? "#767676"}
                                        emoji={target.emoji ?? null}
                                        icon={target.icon ?? null}
                                        size={22}
                                    />
                                ) : null}
                                <Text className={cn(STATED, "text-foreground")}>{target.name}</Text>
                            </View>
                        ),
                    }}
                    template={t("budgets.sheet.stated")}
                    textClassName={STATED}
                />

                {pickingPeriod ? (
                    <Animated.View className="flex-row flex-wrap gap-2 pt-3.5" entering={revealEntering()}>
                        {PERIODS.map((period) => (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: period === type }}
                                className={cn(
                                    "h-[38px] items-center justify-center rounded-[19px] border px-3.5",
                                    period === type ? "border-tint bg-tint/10" : "border-border"
                                )}
                                key={period}
                                onPress={() => {
                                    haptics("selection");
                                    setType(period);
                                    setPickingPeriod(false);
                                }}
                            >
                                <Text
                                    className={cn("text-subtitle", period === type ? "text-tint" : "text-foreground")}
                                >
                                    {t(budgetPeriodName(period))}
                                </Text>
                            </Pressable>
                        ))}
                    </Animated.View>
                ) : null}

                <View className="flex-row items-baseline justify-between pt-3">
                    <Pressable
                        accessibilityLabel={t("budgets.sheet.editLimitA11y")}
                        accessibilityRole="button"
                        onPress={() => setTyping((open) => !open)}
                    >
                        <HeroNumber amount={limit} code={currency} showCents={false} sign="" size={40} still />
                    </Pressable>
                    <MonoLabel>
                        {evidence.typical === null
                            ? t("budgets.sheet.tapToType").toUpperCase()
                            : t("budgets.sheet.typical", {
                                  amount: money(evidence.typical),
                              }).toUpperCase()}
                    </MonoLabel>
                </View>
            </View>

            {typing ? (
                // Keyed per body: both branches are an `Animated.View` in the same
                // position, so without one React updates the instance in place and
                // the entrance never runs — it reconciles rather than mounts.
                <Animated.View className="px-5 pt-4" entering={revealEntering()} key="pad">
                    <AmountNumpad
                        code={currency}
                        minorUnits={minorUnits}
                        onChange={typeLimit}
                        showDisplay={false}
                        value={entry}
                    />
                </Animated.View>
            ) : (
                <Animated.View className="pt-4" entering={revealEntering()} key="plot">
                    {/* Remounted per cadence: the plot freezes its axis at mount, and a
					    week's curve under a month's axis is a different measure drawn to
					    the wrong scale. */}
                    <BudgetLimitPicker
                        burndown={burndown}
                        currency={currency}
                        history={evidence.history}
                        key={type}
                        limit={limit}
                        nowMs={nowMs}
                        onLimit={dragLimit}
                        periodPhrase={periodPhrase}
                        sampleSize={sampleSize}
                        window={window}
                        windowLabel={windowLabel}
                    />
                </Animated.View>
            )}

            <View className="px-5 pt-5">
                {target.replacesExisting ? (
                    <Text className="text-footnote text-muted pb-3">{t("budgets.sheet.singleton")}</Text>
                ) : null}
                {/* Never inert: a limit of nothing is a limit not typed yet, and the
				    button that would say so is the one being pressed. */}
                <SheetCommitButton label={t("budgets.picker.commit", { amount: money(limit) })} onPress={commit} />
            </View>
        </View>
    );
}
