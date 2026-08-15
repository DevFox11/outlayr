import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Text } from "@/components/text";
import { useSettingBool } from "@/contexts/display-settings-context";
import { monthAbbrevTitle } from "@/domain/dates";
import type { LogMeasure } from "@/domain/log-measure";
import type { SparklinePoint } from "@/domain/log-sparkline";
import { sparklineLabelKey } from "@/domain/sparkline-trend";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";
import { panGesture } from "@/lib/gestures";
import { CHART_SCRUB } from "@/theme/chart";
import { useColors } from "@/theme/use-colors";

const HEIGHT = 34;
const INSET = 10;

interface LogSparklineProps {
    byMonth: boolean;
    /** Decides whether the line has a direction worth speaking. */
    measure: LogMeasure;
    points: SparklinePoint[];
    positive: boolean;
    /** How many trailing points belong to the period being reported. */
    range: number;
}

export function LogSparkline({ points, positive, range, byMonth, measure }: LogSparklineProps) {
    const colors = useColors();
    const t = useTranslation();
    const { language } = useLanguage();
    const reduceMotion = useReducedMotion();
    // Read here, not threaded from the screen: every chart answers to this setting
    // itself. The OS flag is ANDed in by hand because the draw below is a
    // `setTimeout` rather than a Reanimated animation, so there is nothing for the
    // library's own `ReduceMotion.System` handling to collapse.
    const animatedCharts = useSettingBool("animatedCharts") && !reduceMotion;
    const [width, setWidth] = useState(0);
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);
    const [drawnAfterDelay, setDrawnAfterDelay] = useState(false);
    // With charts off there is nothing to draw in, so the sparkline is simply
    // already drawn — derived rather than written back from the effect below.
    const drawn = !animatedCharts || drawnAfterDelay;

    const color = positive ? colors.income : colors.danger;

    useEffect(() => {
        if (!animatedCharts) {
            return;
        }
        // oxlint-disable-next-line react/react-compiler -- restarts the draw-in when the setting is switched back on mid-session; without it the line is already drawn and the animation never replays.
        setDrawnAfterDelay(false);
        const timer = setTimeout(() => setDrawnAfterDelay(true), 100);
        return () => clearTimeout(timer);
    }, [animatedCharts]);

    const geometry = useMemo(() => {
        if (points.length < 2 || width <= 0) {
            return null;
        }
        const amounts = points.map((point) => point.amount);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        // A flat line has no range to normalize against; park it on the baseline
        // rather than dividing by zero.
        const span = max - min || 1;
        const step = width / (points.length - 1);
        const coords = points.map((point, index) => ({
            x: step * index,
            y: HEIGHT - ((point.amount - min) / span) * HEIGHT,
        }));
        return {
            coords,
            d: coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" "),
        };
    }, [points, width]);

    const labelKey = useMemo(
        () =>
            sparklineLabelKey(
                measure,
                points.map((point) => point.amount),
                byMonth
            ),
        [measure, points, byMonth]
    );

    // Where the muted part of the line hands over to the trend colour.
    const boundary = useMemo(() => {
        if (points.length < 2) {
            return 1;
        }
        return Math.min(1, Math.max(0, 1 - (range - 1) / (points.length - 1)));
    }, [points.length, range]);

    // Only numbers cross into the worklet. Capturing `points` would hand
    // Reanimated an array of `Date`s, which it cannot serialize — the gesture
    // throws "Cannot copy value of type `Date`" on the first render.
    const count = points.length;
    const pan = useMemo(
        () =>
            panGesture()
                .onUpdate((event) => {
                    "worklet";
                    if (width <= 0 || count < 2) {
                        return;
                    }
                    const step = width / (count - 1);
                    const index = Math.min(count - 1, Math.max(0, Math.round(event.x / step)));
                    runOnJS(setScrubIndex)(index);
                })
                .onFinalize(() => {
                    "worklet";
                    runOnJS(setScrubIndex)(null);
                }),
        [count, width]
    );

    if (points.length < 2) {
        return null;
    }

    const scrubbed = scrubIndex == null ? null : points[scrubIndex];
    const scrubCoord = scrubIndex == null ? null : (geometry?.coords[scrubIndex] ?? null);
    // Before the period starts, the scrubber marks history rather than the figure
    // the hero is reporting — so it takes the rule's colour, not the trend's.
    const scrubColor = scrubIndex != null && points.length - range > scrubIndex ? colors.border : color;

    return (
        <View className="pt-4 pb-1" style={{ paddingHorizontal: INSET }}>
            {/* The scrub is a pointer gesture with nothing to commit, so unlike the
			    Insights charts there is no per-sample action to expose — one labelled
			    node naming the line is the whole readout. */}
            <GestureDetector gesture={pan}>
                <View
                    accessibilityLabel={t(labelKey)}
                    accessibilityRole="image"
                    accessible
                    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
                    style={{ height: HEIGHT }}
                >
                    {geometry ? (
                        <Svg height={HEIGHT} width="100%">
                            <Defs>
                                <LinearGradient id="spark" x1="0" x2="1" y1="0" y2="0">
                                    <Stop offset={Math.max(0, boundary - 0.01)} stopColor={colors.border} />
                                    <Stop offset={boundary} stopColor={color} />
                                </LinearGradient>
                            </Defs>
                            <Path
                                d={geometry.d}
                                fill="none"
                                opacity={drawn ? 1 : 0}
                                stroke="url(#spark)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                            />
                            <Circle
                                cx={geometry.coords.at(-1)?.x ?? 0}
                                cy={geometry.coords.at(-1)?.y ?? 0}
                                fill={color}
                                opacity={drawn ? 1 : 0}
                                r={CHART_SCRUB.dotRadius}
                            />
                            {scrubCoord ? (
                                <>
                                    {/* Solid, not dashed: a dashed rule here would read as the
									    projection it means on the burn-down. */}
                                    <Path
                                        d={`M${scrubCoord.x} 0 L${scrubCoord.x} ${HEIGHT}`}
                                        stroke={scrubColor}
                                        strokeLinecap="round"
                                        strokeWidth={CHART_SCRUB.ruleWidth}
                                    />
                                    <Circle
                                        cx={scrubCoord.x}
                                        cy={scrubCoord.y}
                                        fill={scrubColor}
                                        r={CHART_SCRUB.activeDotRadius}
                                        stroke={colors.background}
                                        strokeWidth={2}
                                    />
                                </>
                            ) : null}
                        </Svg>
                    ) : null}
                </View>
            </GestureDetector>

            {scrubbed && scrubCoord ? (
                // Only ever on screen while a finger is down, so a screen reader could
                // never reach it and would only announce a sample nobody chose.
                <View
                    accessibilityElementsHidden
                    className="bg-surface-secondary absolute items-center rounded-md px-1.75 py-1"
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                    style={{
                        bottom: HEIGHT + 8,
                        left: INSET + scrubCoord.x - 40,
                        width: 80,
                    }}
                >
                    <Text className="font-sans-medium text-micro text-muted">
                        {formatSample(scrubbed.date, byMonth, language)}
                    </Text>
                    <Text className="font-sans-semibold text-foreground text-label">
                        {formatAmount(scrubbed.amount)}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

/** "24 Jul" by day, "Jul 26" by month. */
function formatSample(date: Date, byMonth: boolean, language: Language): string {
    const month = monthAbbrevTitle(date, language);
    return byMonth ? `${month} ${String(date.getFullYear()).slice(-2)}` : `${date.getDate()} ${month}`;
}

function formatAmount(amount: number): string {
    return Math.abs(amount) < 1000 ? amount.toFixed(2) : amount.toFixed(0);
}
