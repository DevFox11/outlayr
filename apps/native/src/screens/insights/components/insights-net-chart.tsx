import {
	Canvas,
	Circle as SkCircle,
	Group as SkGroup,
	Skia,
	Path as SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Text as RNText, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useDatabase } from "@/contexts/local-data-context";
import {
	bucketDateLabel,
	type InsightsBucket,
	type InsightsPeriod,
} from "@/data/insights";
import { useBoolSetting } from "@/data/settings";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { hatchPathD } from "@/lib/chart-paths";
import { CHART_DRAW, CHART_SCRUB } from "@/theme/chart";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

const HEIGHT = 150;
const LABEL_H = 18;
const LABEL_W = 32;
const PAD = { top: 12, bottom: 12 } as const;
const HEADROOM = 0.1;

interface InsightsNetChartProps {
	buckets: InsightsBucket[];
	/** The running balance through the window — see `runningTotals`. */
	totals: number[];
	period: InsightsPeriod;
	code: string;
	selectedIndex: number | null;
	onScrub: (index: number | null) => void;
	onCommit: (index: number | null) => void;
	nowMs: number;
}

export function InsightsNetChart({
	buckets,
	totals,
	period,
	code,
	selectedIndex,
	onScrub,
	onCommit,
	nowMs,
}: InsightsNetChartProps) {
	const colors = useColors();
	const t = useTranslation();
	const db = useDatabase();
	const animated = useBoolSetting(db, "animatedCharts");

	const [width, setWidth] = useState(0);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);

	const draw = useSharedValue(animated ? 0 : 1);
	const reported = useSharedValue(-1);
	const drawn = useRef(false);

	useEffect(() => {
		if (!animated) {
			draw.value = 1;
			return;
		}
		if (drawn.current) {
			return;
		}
		drawn.current = true;
		draw.value = withTiming(1, {
			duration: CHART_DRAW.durationMs,
			easing: Easing.out(Easing.cubic),
		});
	}, [animated, draw]);

	const liveCount = useMemo(() => {
		let count = buckets.length;
		while (count > 1 && buckets[count - 1].start.getTime() > nowMs) {
			count -= 1;
		}
		return count;
	}, [buckets, nowMs]);

	const live = totals.slice(0, liveCount);

	const plot = useMemo(() => {
		const rawTop = Math.max(0, ...live);
		const rawBottom = Math.min(0, ...live);
		const pad = Math.max(1, rawTop - rawBottom) * HEADROOM;
		const top = rawTop + pad;
		const bottom = rawBottom - pad;
		const span = Math.max(1, top - bottom);
		const plotHeight = HEIGHT - PAD.top - PAD.bottom;
		const y = (value: number) => PAD.top + ((top - value) / span) * plotHeight;
		// Scaled to the *whole* window, not to the live part, so the line lines up
		// with the x-axis labels beneath it.
		const step = buckets.length > 1 ? width / (buckets.length - 1) : 0;
		return { y, zeroY: y(0), x: (index: number) => index * step, step };
	}, [live, width, buckets.length]);

	const geometry = useMemo(() => {
		if (width <= 0 || live.length < 2) {
			return null;
		}
		const line = live
			.map((value, index) => {
				const command = index === 0 ? "M" : "L";
				return `${command} ${plot.x(index)} ${plot.y(value)}`;
			})
			.join(" ");

		const lastX = plot.x(live.length - 1);
		const area = `${line} L ${lastX} ${plot.zeroY} L 0 ${plot.zeroY} Z`;

		return {
			line: Skia.Path.MakeFromSVGString(line),
			surplus: Skia.Path.MakeFromSVGString(area),
			hatch: Skia.Path.MakeFromSVGString(hatchPathD(width, HEIGHT)),
			axis: Skia.Path.MakeFromSVGString(
				`M 0 ${plot.zeroY} L ${width} ${plot.zeroY}`,
			),
		};
	}, [live, plot, width]);

	const marker = scrubIndex ?? selectedIndex;
	const markerRule = useMemo(() => {
		if (marker == null || width <= 0 || marker >= live.length) {
			return null;
		}
		const x = plot.x(marker);
		const over = CHART_SCRUB.ruleOvershoot;
		return Skia.Path.MakeFromSVGString(
			`M ${x} ${PAD.top - over} L ${x} ${HEIGHT - PAD.bottom + over}`,
		);
	}, [marker, plot, width, live.length]);

	const count = live.length;
	const pan = useMemo(() => {
		const step = plot.step;

		const commit = (index: number) => {
			onCommit(selectedIndex === index ? null : index);
		};

		const report = (x: number) => {
			"worklet";
			if (step <= 0) {
				return;
			}
			const index = Math.min(count - 1, Math.max(0, Math.round(x / step)));
			if (index !== reported.value) {
				reported.value = index;
				scheduleOnRN(setScrubIndex, index);
				scheduleOnRN(onScrub, index);
			}
		};

		return Gesture.Pan()
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
				const landed = reported.value;
				reported.value = -1;
				scheduleOnRN(setScrubIndex, null);
				scheduleOnRN(onScrub, null);
				if (landed >= 0) {
					scheduleOnRN(commit, landed);
				}
			});
	}, [count, plot.step, onScrub, onCommit, selectedIndex, reported]);

	const onLayout = (event: LayoutChangeEvent) => {
		setWidth(event.nativeEvent.layout.width);
	};

	const markerValue = marker != null ? live[marker] : undefined;

	return (
		<View>
			<GestureDetector gesture={pan}>
				<View
					collapsable={false}
					onLayout={onLayout}
					style={{ height: HEIGHT }}
				>
					{/* Skia's canvas is a native view and swallows touches, so the pan
					    on the wrapper never sees them unless this opts out. */}
					<Canvas pointerEvents="none" style={{ width, height: HEIGHT }}>
						{geometry?.surplus ? (
							<SkPath
								color={withAlpha(colors.foreground, 0.07)}
								opacity={draw}
								path={geometry.surplus}
							/>
						) : null}

						{geometry?.surplus && geometry.hatch ? (
							<SkGroup
								clip={Skia.XYWHRect(
									0,
									plot.zeroY,
									width,
									Math.max(0, HEIGHT - plot.zeroY),
								)}
								opacity={draw}
							>
								<SkGroup clip={geometry.surplus}>
									<SkPath
										color={withAlpha(colors.overBudget, 0.55)}
										path={geometry.hatch}
										strokeWidth={1.6}
										style="stroke"
									/>
								</SkGroup>
							</SkGroup>
						) : null}

						{/* One path drawn twice, clipped either side of the rule. */}
						{geometry?.line ? (
							<>
								<SkGroup clip={Skia.XYWHRect(0, 0, width, plot.zeroY)}>
									<SkPath
										color={colors.income}
										end={draw}
										path={geometry.line}
										strokeWidth={2.2}
										style="stroke"
									/>
								</SkGroup>
								<SkGroup
									clip={Skia.XYWHRect(
										0,
										plot.zeroY,
										width,
										Math.max(0, HEIGHT - plot.zeroY),
									)}
								>
									<SkPath
										color={colors.overBudget}
										end={draw}
										path={geometry.line}
										strokeWidth={2.2}
										style="stroke"
									/>
								</SkGroup>
							</>
						) : null}

						{geometry?.axis ? (
							<SkPath
								color={colors.foreground}
								path={geometry.axis}
								strokeWidth={1.6}
								style="stroke"
							/>
						) : null}

						{markerRule && marker != null && markerValue != null ? (
							<SkGroup opacity={draw}>
								<SkPath
									color={
										scrubIndex != null
											? colors.foreground
											: withAlpha(colors.foreground, 0.55)
									}
									path={markerRule}
									strokeWidth={CHART_SCRUB.ruleWidth}
									style="stroke"
								/>
								<SkCircle
									color={
										markerValue < 0 ? colors.overBudget : colors.foreground
									}
									cx={plot.x(marker)}
									cy={plot.y(markerValue)}
									r={
										scrubIndex != null
											? CHART_SCRUB.activeDotRadius
											: CHART_SCRUB.dotRadius
									}
								/>
							</SkGroup>
						) : null}
					</Canvas>

					{/* The line itself is one Skia path, so it cannot carry per-slot
					    accessibility; these invisible siblings give VoiceOver the same
					    per-slot readout the bar chart has. */}
					<View
						pointerEvents="none"
						style={{ ...StyleSheetAbsoluteFill, flexDirection: "row" }}
					>
						{live.map((value, index) => (
							<View
								accessibilityLabel={t(
									value < 0
										? "insights.net.slotBehind"
										: "insights.net.slotAhead",
									{
										date: bucketDateLabel(period, buckets[index].start),
										amount: formatAmount(Math.abs(value), code, false),
									},
								)}
								accessibilityRole="button"
								accessibilityState={{ selected: selectedIndex === index }}
								accessible
								key={buckets[index].start.getTime()}
								onAccessibilityTap={() =>
									onCommit(selectedIndex === index ? null : index)
								}
								style={{ width: plot.step }}
							/>
						))}
					</View>
				</View>
			</GestureDetector>

			<View style={{ flexDirection: "row", height: LABEL_H, marginTop: 4 }}>
				{buckets.map((bucket, index) => (
					<View key={bucket.start.getTime()} style={{ flex: 1 }}>
						{showXLabel(period, index, bucket.label) ? (
							<View
								style={{
									position: "absolute",
									left: "50%",
									width: LABEL_W,
									marginLeft: -LABEL_W / 2,
									alignItems: "center",
								}}
							>
								<RNText
									className="font-mono text-micro"
									numberOfLines={1}
									style={{ color: colors.muted }}
								>
									{bucket.label}
								</RNText>
							</View>
						) : null}
					</View>
				))}
			</View>
		</View>
	);
}

const StyleSheetAbsoluteFill = {
	position: "absolute" as const,
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
};

function showXLabel(
	period: InsightsPeriod,
	index: number,
	label: string,
): boolean {
	if (period === "week") {
		return true;
	}
	if (period === "year") {
		return [1, 4, 7, 10].includes(index + 1);
	}
	return [1, 8, 15, 22, 29].includes(Number(label));
}
