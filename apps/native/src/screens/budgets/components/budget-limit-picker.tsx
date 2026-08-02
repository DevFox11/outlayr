import {
	Canvas,
	DashPathEffect,
	Circle as SkCircle,
	Group as SkGroup,
	Skia,
	Line as SkLine,
	Path as SkPath,
	vec,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	Pressable,
	useWindowDimensions,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
import { useTranslation } from "@/i18n";
import { hatchPathD, weekRulesD } from "@/lib/chart-paths";
import { useHaptics } from "@/lib/use-haptics";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface BudgetLimitPickerProps {
	/** Month-to-date burn-down built with `limit: 0`, so `points[].spent` is the curve. */
	burndown: Burndown;
	/** How many expenses are behind the curve. */
	sampleSize: number;
	currency: string;
	windowStart: Date;
	onCommit: (limit: number) => void;
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
const PAD = { left: 6, right: 6, top: 18, bottom: 18 } as const;
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
	y: (value: number) => number,
): string {
	const parts = [`M ${x(1)} ${y(0)}`];
	let previous = 0;
	for (const point of points) {
		parts.push(`L ${x(point.day)} ${y(previous)}`);
		parts.push(`L ${x(point.day)} ${y(point.spent)}`);
		previous = point.spent;
	}
	return parts.join(" ");
}

/** "23 Jul". */
function formatDayMonth(date: Date): string {
	const month = monthAbbrev(date);
	return `${date.getDate()} ${month[0]}${month.slice(1).toLowerCase()}`;
}

export function BudgetLimitPicker({
	burndown,
	sampleSize,
	currency,
	windowStart,
	onCommit,
}: BudgetLimitPickerProps) {
	const { showCents } = useDisplaySettings().state;
	const colors = useColors();
	const haptics = useHaptics();
	const t = useTranslation();
	const { width: windowWidth } = useWindowDimensions();
	const [measured, setMeasured] = useState(0);
	const width = measured > 0 ? measured : windowWidth - GUTTER * 2;

	const cumulative = useMemo(
		() => burndown.points.map((point) => point.spent),
		[burndown],
	);
	const total = cumulative.at(-1) ?? 0;
	const axisTop = Math.max(LIMIT_STEP * 4, total * 1.35);
	const maxLimit = Math.floor(axisTop / LIMIT_STEP) * LIMIT_STEP;
	const elapsedFraction = burndown.points.length / burndown.totalDays;
	const sparse = sampleSize < SPARSE_HISTORY || elapsedFraction < ELAPSED_FLOOR;

	// Opens under the month's total so the curve already crosses it.
	const suggested = useMemo(
		() => snapToStep(total * 0.8, maxLimit),
		[total, maxLimit],
	);
	const [limit, setLimit] = useState(suggested);

	const limitY = useSharedValue(yForLimit(suggested, axisTop));
	const snapped = useSharedValue(suggested);
	const dragging = useSharedValue(false);
	const lastCrossing = useRef<number | null>(null);
	const touched = useRef(false);

	useEffect(() => {
		if (!touched.current) {
			setLimit(suggested);
		}
	}, [suggested]);

	useEffect(() => {
		lastCrossing.current = crossingDay(cumulative, limit);
		// Mid-drag the finger owns the line. This render may be trailing a value the
		// gesture has already left behind, and writing it back would jolt the line.
		if (dragging.value) {
			return;
		}
		limitY.value = yForLimit(limit, axisTop);
		snapped.value = limit;
	}, [limit, axisTop, cumulative, limitY, snapped, dragging]);

	const applyLimit = useCallback(
		(next: number) => {
			touched.current = true;
			if (sparse) {
				haptics("selection");
			} else {
				const crossing = crossingDay(cumulative, next);
				if (crossing !== lastCrossing.current) {
					const turned = lastCrossing.current === null && crossing !== null;
					haptics(turned ? "medium" : "light");
					lastCrossing.current = crossing;
				}
			}
			setLimit(next);
		},
		[cumulative, sparse, haptics],
	);

	const pan = useMemo(() => {
		const report = (y: number) => {
			"worklet";
			const raw = ((PLOT_TOP + PLOT_HEIGHT - y) / PLOT_HEIGHT) * axisTop;
			// Inlined: module-scope worklets break this file's Babel transform.
			const stepped = Math.round(raw / LIMIT_STEP) * LIMIT_STEP;
			const next = Math.min(maxLimit, Math.max(LIMIT_STEP, stepped));
			limitY.value = PLOT_TOP + (1 - next / axisTop) * PLOT_HEIGHT;
			// Only cross to JS when the snapped amount changes, so a full drag costs
			// one call per $25 rather than one per frame.
			if (next !== snapped.value) {
				snapped.value = next;
				scheduleOnRN(applyLimit, next);
			}
		};

		return Gesture.Pan()
			.minDistance(0)
			.shouldCancelWhenOutside(false)
			.onBegin((event) => {
				"worklet";
				dragging.value = true;
				report(event.y);
			})
			.onChange((event) => {
				"worklet";
				report(event.y);
			})
			.onFinalize(() => {
				"worklet";
				dragging.value = false;
			});
	}, [axisTop, maxLimit, applyLimit, limitY, snapped, dragging]);

	const geometry = useMemo(() => {
		const plotLeft = PAD.left;
		const plotRight = width - PAD.right;
		const span = Math.max(1, burndown.totalDays - 1);
		const bottomY = PLOT_TOP + PLOT_HEIGHT;
		const x = (day: number) =>
			plotLeft + ((day - 1) / span) * (plotRight - plotLeft);
		const y = (value: number) => yForLimit(value, axisTop);

		const curveD = curvePathD(burndown.points, x, y);
		const lastDay = burndown.points.at(-1)?.day ?? 1;
		const weeksD = weekRulesD(burndown.totalDays, x, PLOT_TOP, bottomY);

		return {
			x,
			y,
			bottomY,
			plotLeft,
			plotRight,
			lastDay,
			curve: Skia.Path.MakeFromSVGString(curveD),
			area: Skia.Path.MakeFromSVGString(
				`${curveD} L ${x(lastDay)} ${bottomY} L ${x(1)} ${bottomY} Z`,
			),
			weeks: weeksD ? Skia.Path.MakeFromSVGString(weeksD) : null,
			hatch: Skia.Path.MakeFromSVGString(hatchPathD(width, CHART_HEIGHT)),
		};
	}, [burndown, width, axisTop]);

	const limitLineStart = useDerivedValue(() =>
		vec(geometry.plotLeft, limitY.value),
	);
	const limitLineEnd = useDerivedValue(() =>
		vec(geometry.plotRight, limitY.value),
	);
	const crossing = sparse ? null : crossingDay(cumulative, limit);
	const crossingDate =
		crossing == null
			? null
			: new Date(
					windowStart.getFullYear(),
					windowStart.getMonth(),
					windowStart.getDate() + crossing - 1,
				);
	const monthName = formatMonthLabel(windowStart);
	const limitLabel = formatAmount(limit, currency, false);

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
						date: formatDayMonth(crossingDate),
						days: t("budgets.days", { count: early }),
					})
				: t("budgets.picker.ranOutFinal", {
						date: formatDayMonth(crossingDate),
					});
	} else {
		readout = t("budgets.picker.held", {
			month: monthName,
			amount: formatAmount(limit - total, currency, showCents),
		});
	}

	const onLayout = (event: LayoutChangeEvent) => {
		setMeasured(event.nativeEvent.layout.width - GUTTER * 2);
	};

	// The clips are plain props, so they read the committed React value while the
	// line reads the shared one. They agree except for a frame mid-drag.
	const limitYCommitted = yForLimit(limit, axisTop);

	return (
		<View
			onLayout={onLayout}
			style={{ width: "100%", paddingHorizontal: GUTTER }}
		>
			<View className="flex-row items-baseline justify-between">
				<MonoLabel>
					{t("budgets.picker.eyebrow", { month: monthName.toUpperCase() })}
				</MonoLabel>
				<MonoLabel>
					{t("budgets.expenses", { count: sampleSize }).toUpperCase()}
				</MonoLabel>
			</View>

			<View className="pt-2">
				<HeroNumber
					amount={limit}
					code={currency}
					showCents={false}
					sign=""
					size={40}
				/>
			</View>
			<Text className="pt-0.5 text-footnote text-muted">
				{t("budgets.picker.cadence")}
			</Text>

			<View className="pt-4">
				<GestureDetector gesture={pan}>
					<View
						accessibilityLabel={t("budgets.picker.dragA11y", {
							amount: limitLabel,
						})}
						collapsable={false}
						style={{ width, height: CHART_HEIGHT }}
					>
						{/* Skia's canvas is a native view and swallows touches, so the pan
						    detector on the wrapper never sees them unless this opts out. */}
						<Canvas
							pointerEvents="none"
							style={{ width, height: CHART_HEIGHT }}
						>
							{geometry.area ? (
								<SkPath
									color={withAlpha(colors.foreground, 0.06)}
									path={geometry.area}
								/>
							) : null}

							{geometry.area && geometry.hatch && total > limit ? (
								<SkGroup clip={geometry.area}>
									<SkGroup clip={Skia.XYWHRect(0, 0, width, limitYCommitted)}>
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
								<SkPath
									color={colors.muted}
									path={geometry.weeks}
									strokeWidth={1}
									style="stroke"
								>
									<DashPathEffect intervals={[1.5, 4]} />
								</SkPath>
							) : null}

							<SkPath
								color={colors.foreground}
								path={
									Skia.Path.MakeFromSVGString(
										`M ${geometry.plotLeft} ${geometry.bottomY} L ${geometry.plotRight} ${geometry.bottomY}`,
									) ?? Skia.Path.Make()
								}
								strokeWidth={1.6}
								style="stroke"
							/>

							{/* One path drawn twice, clipped either side of the limit. */}
							{geometry.curve ? (
								<>
									<SkGroup
										clip={Skia.XYWHRect(
											0,
											limitYCommitted,
											width,
											CHART_HEIGHT - limitYCommitted,
										)}
									>
										<SkPath
											color={colors.foreground}
											path={geometry.curve}
											strokeWidth={2.2}
											style="stroke"
										/>
									</SkGroup>
									<SkGroup clip={Skia.XYWHRect(0, 0, width, limitYCommitted)}>
										<SkPath
											color={colors.overBudget}
											path={geometry.curve}
											strokeWidth={2.2}
											style="stroke"
										/>
									</SkGroup>
								</>
							) : null}

							{crossing != null ? (
								<SkPath
									color={withAlpha(colors.overBudget, 0.7)}
									path={
										Skia.Path.MakeFromSVGString(
											`M ${geometry.x(crossing)} ${PLOT_TOP} L ${geometry.x(crossing)} ${geometry.bottomY}`,
										) ?? Skia.Path.Make()
									}
									strokeWidth={1}
									style="stroke"
								>
									<DashPathEffect intervals={[3.5, 3.5]} />
								</SkPath>
							) : null}

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
							<SkCircle
								color={colors.foreground}
								cx={geometry.plotRight - 5}
								cy={limitY}
								r={5}
							/>

							{crossing != null ? (
								<SkCircle
									color={colors.overBudget}
									cx={geometry.x(crossing)}
									cy={limitY}
									r={3.6}
									strokeWidth={2}
									style="stroke"
								/>
							) : null}
						</Canvas>
					</View>
				</GestureDetector>
			</View>

			<View className="flex-row items-baseline justify-between pt-2.5">
				<MonoLabel>{t("budgets.picker.drag")}</MonoLabel>
				<MonoLabel>
					{t("budgets.picker.spent", {
						amount: formatAmount(total, currency, false),
					})}
				</MonoLabel>
			</View>

			<Text className="pt-2.5 text-footnote text-muted">{readout}</Text>

			<Pressable
				accessibilityRole="button"
				className="mt-6 items-center rounded-full bg-accent px-7 py-3.5 active:opacity-80"
				onPress={() => onCommit(limit)}
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					{t("budgets.picker.commit", { amount: limitLabel })}
				</Text>
			</Pressable>
		</View>
	);
}
