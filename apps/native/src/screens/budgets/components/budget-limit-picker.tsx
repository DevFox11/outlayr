import {
    Canvas,
    DashPathEffect,
    Circle as SkCircle,
    Group as SkGroup,
    Line as SkLine,
    Path as SkPath,
    vec,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { HeroNumber } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { Burndown, BurndownPoint } from "@/domain/budget-burndown";
import { crossingDay } from "@/domain/budget-limit-crossing";
import { formatMonthLabel, monthAbbrev } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";
import { hatchPathD, weekRulesD } from "@/lib/chart-paths";
import { panGesture } from "@/lib/gestures";
import { useHaptics } from "@/lib/use-haptics";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface BudgetLimitPickerProps {
    /** Month-to-date burn-down built with `limit: 0`, so `points[].spent` is the curve. */
    burndown: Burndown;
    currency: string;
    onCommit: (limit: number) => void;
    /** How many expenses are behind the curve. */
    sampleSize: number;
    windowStart: Date;
}

const LIMIT_STEP = 25;

/** Below this many expenses the crossing lands wherever the largest charge happened to. */
const SPARSE_HISTORY = 10;

/**
 * How much of the month must have passed before a whole-month verdict is honest —
 * the curve stops at today. Mirrors `PROJECTION_FLOOR`.
 */
const ELAPSED_FLOOR = 0.2;

const CHART_HEIGHT = 200;
const GUTTER = 20;
const PAD = { bottom: 18, left: 6, right: 6, top: 18 } as const;
const PLOT_TOP = PAD.top;
const PLOT_HEIGHT = CHART_HEIGHT - PAD.top - PAD.bottom;

function yForLimit(value: number, axisTop: number): number {
    return PLOT_TOP + (1 - value / axisTop) * PLOT_HEIGHT;
}

function snapToStep(value: number, max: number): number {
    const stepped = Math.round(value / LIMIT_STEP) * LIMIT_STEP;
    return Math.min(max, Math.max(LIMIT_STEP, stepped));
}

function curvePathD(
    points: readonly BurndownPoint[],
    x: (day: number) => number,
    y: (value: number) => number
): string {
    const parts = [`M ${x(1)} ${y(0)}`];
    let previous = 0;
    for (const point of points) {
        parts.push(`L ${x(point.day)} ${y(previous)}`, `L ${x(point.day)} ${y(point.spent)}`);
        previous = point.spent;
    }
    return parts.join(" ");
}

/** "23 Jul". */
function formatDayMonth(date: Date, language: Language): string {
    const month = monthAbbrev(date, language);
    return `${date.getDate()} ${month[0]}${month.slice(1).toLowerCase()}`;
}

export function BudgetLimitPicker({ burndown, sampleSize, currency, windowStart, onCommit }: BudgetLimitPickerProps) {
    const { showCents } = useDisplaySettings().state;
    const colors = useColors();
    const haptics = useHaptics();
    const t = useTranslation();
    const { language } = useLanguage();
    const { width: windowWidth } = useWindowDimensions();
    const [measured, setMeasured] = useState(0);
    const width = measured > 0 ? measured : windowWidth - GUTTER * 2;

    const cumulative = useMemo(() => burndown.points.map((point) => point.spent), [burndown]);
    const total = cumulative.at(-1) ?? 0;
    const axisTop = Math.max(LIMIT_STEP * 4, total * 1.35);
    const maxLimit = Math.floor(axisTop / LIMIT_STEP) * LIMIT_STEP;
    const elapsedFraction = burndown.points.length / burndown.totalDays;
    const sparse = sampleSize < SPARSE_HISTORY || elapsedFraction < ELAPSED_FLOOR;

    // Opens under the month's total so the curve already crosses it.
    const suggested = useMemo(() => snapToStep(total * 0.8, maxLimit), [total, maxLimit]);
    // Null until the user drags, so the picker keeps following the suggestion as
    // the month's total moves rather than needing an effect to re-sync it.
    const [picked, setPicked] = useState<number | null>(null);
    const limit = picked ?? suggested;

    const limitY = useSharedValue(yForLimit(suggested, axisTop));
    const snapped = useSharedValue(suggested);
    const dragging = useSharedValue(false);
    // Shared rather than a ref because the drag mutates it: a ref written from
    // the gesture closure is state the compiler cannot follow, and it bailed out
    // of optimizing the whole component over it.
    const lastCrossing = useSharedValue<number | null>(null);

    useEffect(() => {
        lastCrossing.set(crossingDay(cumulative, limit));
        // Mid-drag the finger owns the line. This render may be trailing a value the
        // gesture has already left behind, and writing it back would jolt the line.
        if (dragging.get()) {
            return;
        }
        limitY.set(yForLimit(limit, axisTop));
        snapped.set(limit);
    }, [limit, axisTop, cumulative, limitY, snapped, dragging, lastCrossing]);

    const applyLimit = useCallback(
        (next: number) => {
            if (sparse) {
                haptics("selection");
            } else {
                const crossing = crossingDay(cumulative, next);
                if (crossing !== lastCrossing.get()) {
                    const turned = lastCrossing.get() === null && crossing !== null;
                    haptics(turned ? "medium" : "light");
                    lastCrossing.set(crossing);
                }
            }
            setPicked(next);
        },
        [cumulative, sparse, haptics, lastCrossing]
    );

    const pan = useMemo(() => {
        const report = (y: number) => {
            "worklet";
            const raw = ((PLOT_TOP + PLOT_HEIGHT - y) / PLOT_HEIGHT) * axisTop;
            // Inlined: module-scope worklets break this file's Babel transform.
            const stepped = Math.round(raw / LIMIT_STEP) * LIMIT_STEP;
            const next = Math.min(maxLimit, Math.max(LIMIT_STEP, stepped));
            limitY.set(PLOT_TOP + (1 - next / axisTop) * PLOT_HEIGHT);
            // Only cross to JS when the snapped amount changes, so a full drag costs
            // one call per $25 rather than one per frame.
            if (next !== snapped.get()) {
                snapped.set(next);
                scheduleOnRN(applyLimit, next);
            }
        };

        return panGesture()
            .minDistance(0)
            .shouldCancelWhenOutside(false)
            .onBegin((event) => {
                "worklet";
                dragging.set(true);
                report(event.y);
            })
            .onChange((event) => {
                "worklet";
                report(event.y);
            })
            .onFinalize(() => {
                "worklet";
                dragging.set(false);
            });
    }, [axisTop, maxLimit, applyLimit, limitY, snapped, dragging]);

    const geometry = useMemo(() => {
        const plotLeft = PAD.left;
        const plotRight = width - PAD.right;
        const span = Math.max(1, burndown.totalDays - 1);
        const bottomY = PLOT_TOP + PLOT_HEIGHT;
        const x = (day: number) => plotLeft + ((day - 1) / span) * (plotRight - plotLeft);
        const y = (value: number) => yForLimit(value, axisTop);

        const curveD = curvePathD(burndown.points, x, y);
        const lastDay = burndown.points.at(-1)?.day ?? 1;
        const weeksD = weekRulesD(burndown.totalDays, x, PLOT_TOP, bottomY);

        return {
            area: `${curveD} L ${x(lastDay)} ${bottomY} L ${x(1)} ${bottomY} Z`,
            bottomY,
            curve: curveD,
            hatch: hatchPathD(width, CHART_HEIGHT),
            lastDay,
            plotLeft,
            plotRight,
            weeks: weeksD,
            x,
            y,
        };
    }, [burndown, width, axisTop]);

    const limitLineStart = useDerivedValue(() => vec(geometry.plotLeft, limitY.get()));
    const limitLineEnd = useDerivedValue(() => vec(geometry.plotRight, limitY.get()));
    const crossing = sparse ? null : crossingDay(cumulative, limit);
    const crossingDate =
        crossing == null
            ? null
            : new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate() + crossing - 1);
    const monthName = formatMonthLabel(windowStart, language);
    const limitLabel = formatAmount(limit, currency, false, language);

    let readout: string;
    if (sparse) {
        readout =
            sampleSize < SPARSE_HISTORY
                ? t("budgets.picker.sparseExpenses", {
                      expenses: t("budgets.expenses", { count: sampleSize }),
                      month: monthName,
                  })
                : t("budgets.picker.sparseDays", {
                      days: t("budgets.days", { count: burndown.points.length }),
                      month: monthName,
                  });
    } else if (crossingDate && crossing != null) {
        const early = burndown.totalDays - crossing;
        readout =
            early > 0
                ? t("budgets.picker.ranOutEarly", {
                      date: formatDayMonth(crossingDate, language),
                      days: t("budgets.days", { count: early }),
                  })
                : t("budgets.picker.ranOutFinal", {
                      date: formatDayMonth(crossingDate, language),
                  });
    } else {
        readout = t("budgets.picker.held", {
            amount: formatAmount(limit - total, currency, showCents, language),
            month: monthName,
        });
    }

    const onLayout = (event: LayoutChangeEvent) => {
        setMeasured(event.nativeEvent.layout.width - GUTTER * 2);
    };

    // The clips are plain props, so they read the committed React value while the
    // line reads the shared one. They agree except for a frame mid-drag.
    const limitYCommitted = yForLimit(limit, axisTop);

    return (
        <View onLayout={onLayout} style={{ paddingHorizontal: GUTTER, width: "100%" }}>
            <View className="flex-row items-baseline justify-between">
                <MonoLabel>{t("budgets.picker.eyebrow", { month: monthName.toUpperCase() })}</MonoLabel>
                <MonoLabel>{t("budgets.expenses", { count: sampleSize }).toUpperCase()}</MonoLabel>
            </View>

            <View className="pt-2">
                <HeroNumber amount={limit} code={currency} showCents={false} sign="" size={40} />
            </View>
            <Text className="text-footnote text-muted pt-0.5">{t("budgets.picker.cadence")}</Text>

            <View className="pt-4">
                <GestureDetector gesture={pan}>
                    <View
                        accessibilityLabel={t("budgets.picker.dragA11y", {
                            amount: limitLabel,
                        })}
                        collapsable={false}
                        style={{ height: CHART_HEIGHT, width }}
                    >
                        {/* Skia's canvas is a native view and swallows touches, so the pan
						    detector on the wrapper never sees them unless this opts out. */}
                        <Canvas pointerEvents="none" style={{ height: CHART_HEIGHT, width }}>
                            {geometry.area ? (
                                <SkPath color={withAlpha(colors.foreground, 0.06)} path={geometry.area} />
                            ) : null}

                            {geometry.area && geometry.hatch && total > limit ? (
                                <SkGroup clip={geometry.area}>
                                    <SkGroup clip={{ height: limitYCommitted, width, x: 0, y: 0 }}>
                                        <SkPath
                                            color={withAlpha(colors.overBudget, 0.55)}
                                            path={geometry.hatch}
                                            strokeWidth={1.6}
                                            style="stroke"
                                        />
                                    </SkGroup>
                                </SkGroup>
                            ) : null}

                            {geometry.weeks ? (
                                <SkPath color={colors.muted} path={geometry.weeks} strokeWidth={1} style="stroke">
                                    <DashPathEffect intervals={[1.5, 4]} />
                                </SkPath>
                            ) : null}

                            <SkPath
                                color={colors.foreground}
                                path={`M ${geometry.plotLeft} ${geometry.bottomY} L ${geometry.plotRight} ${geometry.bottomY}`}
                                strokeWidth={1.6}
                                style="stroke"
                            />

                            {/* One path drawn twice, clipped either side of the limit. */}
                            {geometry.curve ? (
                                <>
                                    <SkGroup
                                        clip={{
                                            height: CHART_HEIGHT - limitYCommitted,
                                            width,
                                            x: 0,
                                            y: limitYCommitted,
                                        }}
                                    >
                                        <SkPath
                                            color={colors.foreground}
                                            path={geometry.curve}
                                            strokeWidth={2.2}
                                            style="stroke"
                                        />
                                    </SkGroup>
                                    <SkGroup clip={{ height: limitYCommitted, width, x: 0, y: 0 }}>
                                        <SkPath
                                            color={colors.overBudget}
                                            path={geometry.curve}
                                            strokeWidth={2.2}
                                            style="stroke"
                                        />
                                    </SkGroup>
                                </>
                            ) : null}

                            {crossing == null ? null : (
                                <SkPath
                                    color={withAlpha(colors.overBudget, 0.7)}
                                    path={`M ${geometry.x(crossing)} ${PLOT_TOP} L ${geometry.x(crossing)} ${geometry.bottomY}`}
                                    strokeWidth={1}
                                    style="stroke"
                                >
                                    <DashPathEffect intervals={[3.5, 3.5]} />
                                </SkPath>
                            )}

                            <SkCircle
                                color={colors.foreground}
                                cx={geometry.x(geometry.lastDay)}
                                cy={geometry.y(total)}
                                r={3.2}
                            />

                            <SkLine
                                color={colors.foreground}
                                p1={limitLineStart}
                                p2={limitLineEnd}
                                strokeWidth={1.6}
                                style="stroke"
                            />
                            <SkCircle color={colors.foreground} cx={geometry.plotRight - 5} cy={limitY} r={5} />

                            {crossing == null ? null : (
                                <SkCircle
                                    color={colors.overBudget}
                                    cx={geometry.x(crossing)}
                                    cy={limitY}
                                    r={3.6}
                                    strokeWidth={2}
                                    style="stroke"
                                />
                            )}
                        </Canvas>
                    </View>
                </GestureDetector>
            </View>

            <View className="flex-row items-baseline justify-between pt-2.5">
                <MonoLabel>{t("budgets.picker.drag")}</MonoLabel>
                <MonoLabel>
                    {t("budgets.picker.spent", {
                        amount: formatAmount(total, currency, false, language),
                    })}
                </MonoLabel>
            </View>

            <Text className="text-footnote text-muted pt-2.5">{readout}</Text>

            <Pressable
                accessibilityRole="button"
                className="bg-accent mt-6 items-center rounded-full px-7 py-3.5 active:opacity-80"
                onPress={() => onCommit(limit)}
            >
                <Text className="font-sans-semibold text-accent-foreground text-body">
                    {t("budgets.picker.commit", { amount: limitLabel })}
                </Text>
            </Pressable>
        </View>
    );
}
