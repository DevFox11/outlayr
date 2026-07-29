import { useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Text as RNText, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useDatabase } from "@/contexts/local-data-context";
import {
	bucketDateLabel,
	type InsightsBucket,
	type InsightsMeasure,
	type InsightsPeriod,
} from "@/data/insights";
import { useBoolSetting } from "@/data/settings";
import { currencySymbol, formatAmount } from "@/domain/money";
import {
	CHART_BAR,
	CHART_DASH,
	CHART_DRAW,
	CHART_SCRUB,
	compactMagnitude,
	dashArray,
} from "@/theme/chart";
import { useColors } from "@/theme/use-colors";

const BAR_AREA = 150;
const LABEL_H = 18;
const LABEL_W = 32;
const HEADROOM = 0.1;

interface InsightsBarChartProps {
	buckets: InsightsBucket[];
	period: InsightsPeriod;
	/** Flows only — `net` is drawn by `InsightsNetChart` as a running balance. */
	measure: Exclude<InsightsMeasure, "net">;
	code: string;
	average: number;
	selectedIndex: number | null;
	/** Fires continuously while a finger is down, with the bucket under it. */
	onScrub: (index: number | null) => void;
	/**
	 * Fires once when the finger lifts, with the bucket to lock — or null to
	 * clear, which is what releasing on the already-locked bucket means.
	 */
	onCommit: (index: number | null) => void;
	nowMs: number;
}

interface Plot {
	/** Money units, not points. */
	span: number;
	top: number;
}

/** Both measures here are magnitudes, so the bars sit on a floor of zero. */
function makePlot(values: number[]): Plot {
	const rawTop = Math.max(0, ...values);
	const top = rawTop > 0 ? rawTop * (1 + HEADROOM) : 0;
	return { span: Math.max(1, top), top };
}

/**
 * A tap is a zero-length drag: `minDistance(0)` claims the touch on the way in,
 * so a competing tap gesture would be unresolvable and must not be added.
 */
export function InsightsBarChart({
	buckets,
	period,
	measure,
	code,
	average,
	selectedIndex,
	onScrub,
	onCommit,
	nowMs,
}: InsightsBarChartProps) {
	const colors = useColors();
	const db = useDatabase();
	const animated = useBoolSetting(db, "animatedCharts");

	const [width, setWidth] = useState(0);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);

	const grow = useSharedValue(animated ? 0 : 1);
	const reported = useSharedValue(-1);
	const drawn = useRef(false);

	useEffect(() => {
		if (!animated) {
			grow.value = 1;
			return;
		}
		if (drawn.current) {
			return;
		}
		drawn.current = true;
		grow.value = withTiming(1, {
			duration: CHART_DRAW.durationMs,
			easing: Easing.out(Easing.cubic),
		});
	}, [animated, grow]);

	const gap = period === "week" ? 6 : period === "year" ? 4 : 2;
	const values = buckets.map((bucket) => Math.abs(bucket.value));
	const plot = useMemo(() => makePlot(values), [values]);

	const lastLive = useMemo(() => {
		let index = buckets.length - 1;
		while (index > 0 && buckets[index].start.getTime() > nowMs) {
			index -= 1;
		}
		return index;
	}, [buckets, nowMs]);

	const count = buckets.length;
	// The columns are `flex: 1` inside a gapped row, so the pitch is the bar plus
	// one gap — not `width / count`, which drifts by a whole bar by the right edge
	// of a 31-day month.
	const barWidth =
		count > 0 ? Math.max(0, (width - gap * (count - 1)) / count) : 0;
	const pitch = barWidth + gap;

	const pan = useMemo(() => {
		const step = pitch;

		const commit = (index: number) => {
			onCommit(selectedIndex === index ? null : index);
		};

		const report = (x: number) => {
			"worklet";
			if (step <= 0) {
				return;
			}
			const raw = Math.min(count - 1, Math.floor(x / step));
			const index = Math.min(lastLive, Math.max(0, raw));
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
	}, [count, pitch, lastLive, onScrub, onCommit, selectedIndex, reported]);

	const active = scrubIndex ?? selectedIndex;
	const symbol = currencySymbol(code);

	const activeCount = values.filter((value) => value !== 0).length;
	const avgY = ((plot.top - average) / plot.span) * BAR_AREA;
	const showAverage =
		activeCount > 1 && avgY > BAR_AREA * 0.1 && avgY < BAR_AREA * 0.9;

	const onLayout = (event: LayoutChangeEvent) => {
		setWidth(event.nativeEvent.layout.width);
	};

	return (
		<View>
			<GestureDetector gesture={pan}>
				<View onLayout={onLayout}>
					<View style={{ flexDirection: "row", height: BAR_AREA, gap }}>
						{buckets.map((bucket, index) => (
							<Bar
								color={barColor(measure, colors)}
								dimmed={active != null && active !== index}
								future={bucket.start.getTime() > nowMs}
								grow={grow}
								key={bucket.start.getTime()}
								// The pan is a pointer gesture and reaches no one driving
								// VoiceOver, so each bar carries its own label and activation.
								label={`${bucketDateLabel(period, bucket.start)}, ${formatAmount(
									Math.abs(bucket.value),
									code,
									false,
								)}`}
								onActivate={() =>
									onCommit(selectedIndex === index ? null : index)
								}
								plot={plot}
								selected={selectedIndex === index}
								trackColor={colors.railTrack}
								value={values[index]}
							/>
						))}
					</View>

					{scrubIndex != null && width > 0 ? (
						<View
							pointerEvents="none"
							style={{
								position: "absolute",
								top: -CHART_SCRUB.ruleOvershoot,
								height: BAR_AREA + CHART_SCRUB.ruleOvershoot * 2,
								width: CHART_SCRUB.ruleWidth,
								backgroundColor: colors.foreground,
								left: pitch * scrubIndex + barWidth / 2,
							}}
						/>
					) : null}

					{showAverage ? (
						<View
							pointerEvents="none"
							style={{
								position: "absolute",
								top: avgY - 7,
								left: 0,
								right: 0,
								flexDirection: "row",
								alignItems: "center",
								gap: 3,
							}}
						>
							<View
								style={{
									borderRadius: 5,
									paddingHorizontal: 4,
									paddingVertical: 1,
									backgroundColor: colors.background,
								}}
							>
								<AxisLabel color={colors.muted}>
									{`${symbol}${compactMagnitude(average)}`}
								</AxisLabel>
							</View>
							<DashedRule color={colors.muted} />
						</View>
					) : null}
				</View>
			</GestureDetector>

			<View
				style={{ flexDirection: "row", height: LABEL_H, gap, marginTop: 4 }}
			>
				{buckets.map((bucket, index) => (
					<View key={bucket.start.getTime()} style={{ flex: 1 }}>
						{/* A month column is a couple of points wide, so the label has to
						    overflow it rather than truncate. */}
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
								<AxisLabel color={colors.muted}>{bucket.label}</AxisLabel>
							</View>
						) : null}
					</View>
				))}
			</View>
		</View>
	);
}

function barColor(
	measure: Exclude<InsightsMeasure, "net">,
	colors: ReturnType<typeof useColors>,
): string {
	return measure === "income" ? colors.income : colors.foreground;
}

function DashedRule({ color }: { color: string }) {
	const [width, setWidth] = useState(0);
	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			style={{ flex: 1, height: 2 }}
		>
			{width > 0 ? (
				<Svg height={2} width={width}>
					<Line
						stroke={color}
						strokeDasharray={dashArray(CHART_DASH.reference)}
						strokeLinecap="round"
						strokeWidth={2}
						x1={0}
						x2={width}
						y1={1}
						y2={1}
					/>
				</Svg>
			) : null}
		</View>
	);
}

interface BarProps {
	value: number;
	plot: Plot;
	color: string;
	trackColor: string;
	grow: ReturnType<typeof useSharedValue<number>>;
	dimmed: boolean;
	future: boolean;
	label: string;
	selected: boolean;
	onActivate: () => void;
}

function Bar({
	value,
	plot,
	color,
	trackColor,
	grow,
	dimmed,
	future,
	label,
	selected,
	onActivate,
}: BarProps) {
	const target =
		value > 0
			? Math.max(CHART_BAR.minHeight, (value / plot.span) * BAR_AREA)
			: 0;

	const fillStyle = useAnimatedStyle(() => ({
		height: target * grow.value,
	}));

	return (
		<View
			accessibilityLabel={label}
			accessibilityRole={future ? "image" : "button"}
			accessibilityState={{ selected }}
			accessible
			onAccessibilityTap={future ? undefined : onActivate}
			style={{
				flex: 1,
				height: BAR_AREA,
				borderRadius: CHART_BAR.radius,
				backgroundColor: trackColor,
				opacity: future ? 0.3 : dimmed ? 0.4 : 1,
			}}
		>
			<Animated.View
				style={[
					{
						position: "absolute",
						left: 0,
						right: 0,
						bottom: 0,
						borderRadius: CHART_BAR.radius,
						backgroundColor: color,
					},
					fillStyle,
				]}
			/>
		</View>
	);
}

function AxisLabel({ children, color }: { children: string; color: string }) {
	return (
		<RNText
			className="font-mono text-micro"
			numberOfLines={1}
			style={{ color }}
		>
			{children}
		</RNText>
	);
}

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
