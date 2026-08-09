import {
	Canvas,
	DashPathEffect,
	Circle as SkCircle,
	Group as SkGroup,
	Skia,
	Path as SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Easing, type SharedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSettingBool } from "@/contexts/display-settings-context";
import type { Burndown } from "@/domain/budget-burndown";
import { useTranslation } from "@/i18n/context";
import { hatchPathD } from "@/lib/chart-paths";
import { CHART_DASH, CHART_DRAW, CHART_SCRUB } from "@/theme/chart";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface BudgetBurndownChartProps {
	burndown: Burndown;
	/**
	 * `auto` fits the plot to this budget's own range; `limit` pins the axis to
	 * ±the limit so a column of thumbnails shares one unit — without it a
	 * 200%-over budget looks identical to a 2%-over one.
	 */
	domain?: "auto" | "limit";
	height?: number;
	/**
	 * False turns the chart into a static sparkline. The pan claims the touch the
	 * moment it lands, so a thumbnail inside a pressable row must opt out or the
	 * row never registers a tap.
	 */
	interactive?: boolean;
	limit: number;
	/** Called with the scrubbed day (1-indexed) or null when the finger lifts. */
	onScrub?: (day: number | null) => void;
	width: number;
}

const PAD = { bottom: 10, left: 4, right: 4, top: 10 } as const;

interface Plot {
	plotLeft: number;
	plotRight: number;
	span: number;
	x: (day: number) => number;
	y: (value: number) => number;
	zeroY: number;
}

/**
 * The money axis always includes both the limit and zero, so the zero rule is on
 * screen whether the budget held or blew, and stretches to cover the projection
 * when it dips below the worst actual balance.
 */
function makePlot(burndown: Burndown, limit: number, width: number, height: number, domain: "auto" | "limit"): Plot {
	const plotLeft = PAD.left;
	const plotRight = width - PAD.right;
	const span = Math.max(1, burndown.totalDays - 1);

	let rawTop: number;
	let rawBottom: number;
	if (domain === "limit") {
		// Fixed at ±limit so depth means severity across rows; worse clamps.
		rawTop = Math.max(1, limit);
		rawBottom = -rawTop;
	} else {
		const balances = burndown.points.map((p) => p.balance);
		const candidates = [limit, 0, ...balances];
		if (burndown.projectedBalance != null) {
			candidates.push(burndown.projectedBalance);
		}
		rawTop = Math.max(...candidates);
		rawBottom = Math.min(...candidates);
	}
	// A flat budget (nothing spent) would collapse the range to a point.
	const range = Math.max(1, rawTop - rawBottom);

	const plotTop = PAD.top;
	const plotHeight = height - PAD.top - PAD.bottom;

	const y = (value: number) => {
		const clamped = Math.min(rawTop, Math.max(rawBottom, value));
		return plotTop + ((rawTop - clamped) / range) * plotHeight;
	};

	return {
		plotLeft,
		plotRight,
		span,
		x: (day) => plotLeft + ((day - 1) / span) * (plotRight - plotLeft),
		y,
		zeroY: y(0),
	};
}

function actualPathD(burndown: Burndown, limit: number, plot: Plot): string {
	const parts = [`M ${plot.x(1)} ${plot.y(limit)}`];
	let previous = limit;
	for (const point of burndown.points) {
		parts.push(`L ${plot.x(point.day)} ${plot.y(previous)}`);
		parts.push(`L ${plot.x(point.day)} ${plot.y(point.balance)}`);
		previous = point.balance;
	}
	return parts.join(" ");
}

function deficitPathD(burndown: Burndown, plot: Plot, last: Burndown["points"][number], crossX: number): string {
	const tail =
		burndown.projectedBalance == null
			? `L ${plot.x(last.day)} ${plot.zeroY}`
			: `L ${plot.x(burndown.totalDays)} ${plot.y(burndown.projectedBalance)} L ${plot.x(burndown.totalDays)} ${plot.zeroY}`;
	return `M ${crossX} ${plot.zeroY} L ${crossX} ${plot.y(last.balance)} L ${plot.x(last.day)} ${plot.y(last.balance)} ${tail} Z`;
}

function makeGeometry(burndown: Burndown, limit: number, width: number, height: number, domain: "auto" | "limit") {
	const plot = makePlot(burndown, limit, width, height, domain);
	const last = burndown.points.at(-1);
	const actualD = actualPathD(burndown, limit, plot);

	const actual = Skia.Path.MakeFromSVGString(actualD);
	const ideal = Skia.Path.MakeFromSVGString(
		`M ${plot.x(1)} ${plot.y(limit)} L ${plot.x(burndown.totalDays)} ${plot.y(0)}`
	);

	const projection =
		last && burndown.projectedBalance != null
			? Skia.Path.MakeFromSVGString(
					`M ${plot.x(last.day)} ${plot.y(last.balance)} L ${plot.x(burndown.totalDays)} ${plot.y(burndown.projectedBalance)}`
				)
			: null;

	const surplus = Skia.Path.MakeFromSVGString(
		`${actualD} L ${plot.x(last?.day ?? 1)} ${plot.zeroY} L ${plot.x(1)} ${plot.zeroY} Z`
	);

	const deficit =
		burndown.runwayDay != null && last
			? Skia.Path.MakeFromSVGString(deficitPathD(burndown, plot, last, plot.x(burndown.runwayDay)))
			: null;

	const hatch = Skia.Path.MakeFromSVGString(hatchPathD(width, height));

	const axis = Skia.Path.MakeFromSVGString(`M ${plot.plotLeft} ${plot.zeroY} L ${plot.plotRight} ${plot.zeroY}`);

	return {
		actual,
		axis,
		deficit,
		hatch,
		ideal,
		last,
		plot,
		projection,
		surplus,
	};
}

interface BurndownMarkerProps {
	colors: ReturnType<typeof useColors>;
	draw: SharedValue<number>;
	marker: Burndown["points"][number];
	markerRule: ReturnType<typeof Skia.Path.MakeFromSVGString>;
	plot: Plot;
	scrubbing: boolean;
}

function BurndownMarker({ colors, draw, marker, markerRule, plot, scrubbing }: BurndownMarkerProps) {
	return (
		<SkGroup opacity={draw}>
			{markerRule ? (
				<SkPath
					color={scrubbing ? colors.foreground : withAlpha(colors.foreground, 0.55)}
					path={markerRule}
					strokeWidth={CHART_SCRUB.ruleWidth}
					style="stroke"
				/>
			) : null}
			<SkCircle
				color={marker.balance < 0 ? colors.overBudget : colors.foreground}
				cx={plot.x(marker.day)}
				cy={plot.y(marker.balance)}
				r={scrubbing ? CHART_SCRUB.activeDotRadius : CHART_SCRUB.dotRadius}
			/>
		</SkGroup>
	);
}

interface PanGestureParams {
	activeDay: SharedValue<number>;
	interactive: boolean;
	lastDay: number;
	onScrub?: (day: number | null) => void;
	plot: Plot;
	scrubX: SharedValue<number>;
	setScrubDay: (day: number | null) => void;
}

function makePanGesture({ activeDay, interactive, lastDay, onScrub, plot, scrubX, setScrubDay }: PanGestureParams) {
	const { plotLeft, plotRight, span } = plot;

	const report = (x: number) => {
		"worklet";
		scrubX.value = x;
		const ratio = (x - plotLeft) / Math.max(1, plotRight - plotLeft);
		const day = Math.round(ratio * span) + 1;
		const clamped = Math.min(lastDay, Math.max(1, day));
		// Only cross to JS when the snapped day actually changes, so a full
		// swipe costs one call per day rather than one per frame.
		if (clamped !== activeDay.value) {
			activeDay.value = clamped;
			scheduleOnRN(setScrubDay, clamped);
			if (onScrub) {
				scheduleOnRN(onScrub, clamped);
			}
		}
	};

	return Gesture.Pan()
		.enabled(interactive)
		.minDistance(0)
		.shouldCancelWhenOutside(false)
		.onBegin((event) => {
			"worklet";
			report(event.x);
		})
		.onChange((event) => {
			"worklet";
			report(event.x);
		})
		.onFinalize(() => {
			"worklet";
			scrubX.value = -1;
			activeDay.value = -1;
			scheduleOnRN(setScrubDay, null);
			if (onScrub) {
				scheduleOnRN(onScrub, null);
			}
		});
}

export function BudgetBurndownChart({
	burndown,
	limit,
	width,
	height = 150,
	onScrub,
	interactive = true,
	domain = "auto",
}: BudgetBurndownChartProps) {
	const colors = useColors();
	const t = useTranslation();
	const reduceMotion = useReducedMotion();
	const animatedCharts = useSettingBool("animatedCharts") && !reduceMotion;
	const [scrubDay, setScrubDay] = useState<number | null>(null);

	const scrubX = useSharedValue(-1);
	const activeDay = useSharedValue(-1);
	const draw = useSharedValue(0);
	const drawn = useRef(false);

	useEffect(() => {
		if (!animatedCharts) {
			draw.value = 1;
			return;
		}
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome types `useRef(false).current` as the literal `false` even when annotated `useRef<boolean>`; it is assigned true on the next line and survives this effect's later runs.
		if (drawn.current) {
			return;
		}
		drawn.current = true;
		draw.value = withTiming(1, {
			duration: CHART_DRAW.durationMs,
			easing: Easing.out(Easing.cubic),
		});
	}, [animatedCharts, draw]);

	const geometry = useMemo(
		() => makeGeometry(burndown, limit, width, height, domain),
		[burndown, limit, width, height, domain]
	);

	const { plot, last } = geometry;

	const scrubbed = scrubDay == null ? null : burndown.points[scrubDay - 1];
	const marker = scrubbed ?? last;

	// Kept out of the JSX so a scrub re-render reparses this one line rather than
	// every path, and out of `geometry` so the day it tracks cannot invalidate them.
	const markerRule = useMemo(() => {
		if (!marker) {
			return null;
		}
		const x = plot.x(marker.day);
		const over = CHART_SCRUB.ruleOvershoot;
		return Skia.Path.MakeFromSVGString(`M ${x} ${PAD.top - over} L ${x} ${height - PAD.bottom + over}`);
	}, [plot, marker, height]);

	const pan = useMemo(
		() =>
			makePanGesture({
				activeDay,
				interactive,
				lastDay: burndown.points.length,
				onScrub,
				plot,
				scrubX,
				setScrubDay,
			}),
		[plot, burndown.points.length, onScrub, interactive, scrubX, activeDay]
	);

	/**
	 * A share of the limit rather than an amount: the chart is handed no currency
	 * code, and reading out a bare number would leave it unqualified. The whole
	 * plot is also one Skia path with nothing to commit, so unlike the Insights
	 * charts there is no per-day action to expose — this one sentence is the
	 * readout.
	 */
	const summary = useMemo(() => {
		const day = last?.day ?? 1;
		const balance = last?.balance ?? limit;
		const share = Math.round((Math.abs(balance) / Math.max(1, limit)) * 100);
		return t(balance < 0 ? "insights.burndown.over" : "insights.burndown.holding", {
			day,
			days: burndown.totalDays,
			percent: share,
		});
	}, [last, limit, burndown.totalDays, t]);

	// A non-interactive chart is a thumbnail inside a budget row or card whose own
	// label already reports these figures, so it leaves the tree rather than making
	// every row read twice.
	const canvas = (
		<View
			accessibilityElementsHidden={!interactive}
			accessibilityLabel={interactive ? summary : undefined}
			accessibilityRole={interactive ? "image" : undefined}
			accessible={interactive}
			collapsable={false}
			importantForAccessibility={interactive ? undefined : "no-hide-descendants"}
			style={{ height, width }}
		>
			{/* Skia's canvas is a native view and swallows touches, so the pan
				    detector on the wrapper never sees them unless this opts out. */}
			<Canvas pointerEvents="none" style={{ height, width }}>
				{geometry.surplus ? (
					<SkPath color={withAlpha(colors.foreground, 0.07)} opacity={draw} path={geometry.surplus} />
				) : null}

				{geometry.deficit && geometry.hatch ? (
					<SkGroup clip={geometry.deficit} opacity={draw}>
						<SkPath color={withAlpha(colors.overBudget, 0.55)} path={geometry.hatch} strokeWidth={1.6} style="stroke" />
					</SkGroup>
				) : null}

				{geometry.ideal ? (
					<SkPath color={colors.muted} path={geometry.ideal} strokeWidth={1} style="stroke">
						<DashPathEffect intervals={[...CHART_DASH.reference]} />
					</SkPath>
				) : null}

				{/* One path drawn twice, clipped either side of the zero rule. */}
				{geometry.actual ? (
					<>
						<SkGroup clip={Skia.XYWHRect(0, 0, width, plot.zeroY)}>
							<SkPath color={colors.foreground} end={draw} path={geometry.actual} strokeWidth={2.2} style="stroke" />
						</SkGroup>
						<SkGroup clip={Skia.XYWHRect(0, plot.zeroY, width, height - plot.zeroY)}>
							<SkPath color={colors.overBudget} end={draw} path={geometry.actual} strokeWidth={2.2} style="stroke" />
						</SkGroup>
					</>
				) : null}

				{geometry.projection ? (
					<SkPath
						color={(burndown.projectedBalance ?? 0) < 0 ? colors.overBudget : colors.muted}
						opacity={draw}
						path={geometry.projection}
						strokeWidth={1.6}
						style="stroke"
					>
						<DashPathEffect intervals={[...CHART_DASH.projection]} />
					</SkPath>
				) : null}

				{geometry.axis ? (
					<SkPath color={colors.foreground} path={geometry.axis} strokeWidth={1.6} style="stroke" />
				) : null}

				{burndown.runwayDay == null ? null : (
					<SkCircle
						color={colors.overBudget}
						cx={plot.x(burndown.runwayDay)}
						cy={plot.zeroY}
						opacity={draw}
						r={3.4}
						strokeWidth={2}
						style="stroke"
					/>
				)}

				{marker ? (
					<BurndownMarker
						colors={colors}
						draw={draw}
						marker={marker}
						markerRule={markerRule}
						plot={plot}
						scrubbing={scrubbed != null}
					/>
				) : null}
			</Canvas>
		</View>
	);

	// A disabled detector still claims the touch, leaving the thumbnail a dead
	// zone for the row's swipe.
	return interactive ? <GestureDetector gesture={pan}>{canvas}</GestureDetector> : canvas;
}
