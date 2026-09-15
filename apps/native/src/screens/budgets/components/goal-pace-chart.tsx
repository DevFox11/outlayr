import { Canvas, DashPathEffect, Circle as SkCircle, Path as SkPath } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useSettingBool } from "@/contexts/display-settings-context";
import type { GoalLinePoint } from "@/domain/goal-pace-geometry";
import { makeGeometry } from "@/domain/goal-pace-geometry";
import { useChartDraw } from "@/hooks/use-chart-draw";
import { CHART_DASH } from "@/theme/chart";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface GoalPaceChartProps {
    /** The account's balance over the goal's span, oldest first. */
    actual: readonly GoalLinePoint[];
    /** Accessible summary; the caller states the figures, so it is passed in. */
    label?: string;
    height?: number;
    nowMs: number;
    /** The straight line from the starting balance to the target. */
    required: readonly GoalLinePoint[];
    startTime: number;
    target: number;
    targetTime: number;
    width: number;
}

/**
 * Where the account has actually gone against where the date needs it to go.
 *
 * The dashed reference is the same `CHART_DASH.reference` a budget's ideal
 * burndown uses, pointed the other way: a budget's line falls to zero, a goal's
 * climbs to the target. The gap between the two lines at today IS the standing —
 * so the chart and the "ahead by $212" beside it are one measure drawn twice
 * rather than two figures that can disagree.
 */
export function GoalPaceChart({
    actual,
    height = 150,
    label,
    nowMs,
    required,
    startTime,
    target,
    targetTime,
    width,
}: GoalPaceChartProps) {
    const colors = useColors();
    const reduceMotion = useReducedMotion();
    const animatedCharts = useSettingBool("animatedCharts") && !reduceMotion;
    const draw = useChartDraw(animatedCharts);

    const geometry = useMemo(
        () => makeGeometry({ actual, height, nowMs, required, startTime, target, targetTime, width }),
        [actual, required, startTime, targetTime, target, nowMs, width, height]
    );

    return (
        <View
            accessibilityLabel={label}
            accessibilityRole={label ? "image" : undefined}
            accessible={label != null}
            collapsable={false}
            style={{ height, width }}
        >
            <Canvas pointerEvents="none" style={{ height, width }}>
                {/* Drawn first so the balance line reads over it. */}
                <SkPath color={colors.muted} path={geometry.required} strokeWidth={1} style="stroke">
                    <DashPathEffect intervals={[...CHART_DASH.reference]} />
                </SkPath>

                <SkPath color={colors.border} path={geometry.axis} strokeWidth={1} style="stroke" />

                {geometry.actual ? (
                    <SkPath
                        color={colors.foreground}
                        end={draw}
                        path={geometry.actual}
                        strokeWidth={2.2}
                        style="stroke"
                    />
                ) : null}

                {geometry.projection ? (
                    <SkPath
                        color={withAlpha(colors.foreground, 0.4)}
                        opacity={draw}
                        path={geometry.projection}
                        strokeWidth={1.4}
                        style="stroke"
                    >
                        <DashPathEffect intervals={[...CHART_DASH.projection]} />
                    </SkPath>
                ) : null}

                {geometry.head ? (
                    <SkCircle
                        color={colors.foreground}
                        cx={geometry.head.x}
                        cy={geometry.head.y}
                        opacity={draw}
                        r={3.8}
                    />
                ) : null}

                {/* The target itself, hollow: a mark the line has not reached yet. */}
                <SkCircle
                    color={colors.foreground}
                    cx={geometry.goal.x}
                    cy={geometry.goal.y}
                    opacity={draw}
                    r={3.8}
                    strokeWidth={1.6}
                    style="stroke"
                />
            </Canvas>
        </View>
    );
}
