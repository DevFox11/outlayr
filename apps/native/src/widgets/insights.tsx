import {
	Circle,
	HStack,
	Rectangle,
	Spacer,
	Text,
	VStack,
} from "@expo/ui/swift-ui";
import {
	containerBackground,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	padding,
	widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";
import { createWidget } from "expo-widgets";
import type { InsightsWidgetProps } from "./props";

/**
 * Runs in the widget extension's `JSContext`, so only `props`, `environment` and
 * the `@expo/ui` globals are in scope — see the note in `budget.tsx`.
 *
 * The bars are spend only: mixing a signed net into a bar series makes payday a
 * 147pt spike and every ordinary day a clamped stub, the exact failure
 * `runningTotals` documents.
 */
const InsightsWidget = (
	props: InsightsWidgetProps,
	environment: WidgetEnvironment,
) => {
	"widget";

	const scheme = environment.colorScheme === "dark" ? "dark" : "light";
	const palette = props.chrome[scheme];
	const isSmall = environment.widgetFamily === "systemSmall";

	const eyebrow = (value: string) => (
		<Text
			modifiers={[
				font({ design: "monospaced", size: 10, weight: "medium" }),
				foregroundStyle(palette.muted),
				lineLimit(1),
			]}
		>
			{value}
		</Text>
	);

	// Hand-built rather than a `Chart`. SwiftUI Charts brings its own axis chrome
	// — grey gridlines and a numeric scale down the side — and `@expo/ui` exposes
	// no way to hide it, so the tile rendered "200 / 150 / 100 / 50" in system
	// grey next to the hero.
	const peak = props.bars.reduce((max, bar) => (bar.y > max ? bar.y : max), 0);
	const bars = (height: number, showLabels: boolean) => (
		<VStack alignment="leading" spacing={4}>
			<HStack alignment="bottom" spacing={3}>
				{/* biome-ignore-start lint/suspicious/noArrayIndexKey: a bucket IS its
				    position in the window — Tuesday is the third slot, and two empty
				    Thursdays are genuinely indistinguishable by value. The series is
				    fixed-length and never reordered, so the index is the stable
				    identity here rather than a stand-in for one. */}
				{props.bars.map((bar, index) => (
					<Rectangle
						key={index}
						modifiers={[
							// An empty slot keeps a hairline stub instead of vanishing, so the
							// window reads as a fixed number of buckets with gaps.
							frame({
								height: peak > 0 ? Math.max(1, (bar.y / peak) * height) : 1,
								maxWidth: Number.POSITIVE_INFINITY,
							}),
							foregroundStyle(bar.y > 0 ? palette.ink : palette.border),
						]}
					/>
				))}
			</HStack>
			{/* Only a week is labelled: a month's 31 buckets collapse into an
			    unreadable band, and the eyebrow already names the window. */}
			{showLabels && props.bars.length <= 7 ? (
				<HStack spacing={3}>
					{props.bars.map((bar, index) => (
						<Text
							key={index}
							modifiers={[
								font({ design: "monospaced", size: 8, weight: "medium" }),
								foregroundStyle(palette.muted),
								frame({ maxWidth: Number.POSITIVE_INFINITY }),
								lineLimit(1),
							]}
						>
							{bar.x}
						</Text>
					))}
				</HStack>
			) : null}
			{/* biome-ignore-end lint/suspicious/noArrayIndexKey: see above. */}
		</VStack>
	);

	const cell = (label: string, value: string, leading: boolean) => (
		<HStack spacing={0}>
			{leading ? null : (
				<Rectangle
					modifiers={[frame({ width: 1 }), foregroundStyle(palette.border)]}
				/>
			)}
			<VStack
				alignment="leading"
				modifiers={[
					frame({ maxWidth: Number.POSITIVE_INFINITY, alignment: "leading" }),
					padding({ leading: leading ? 0 : 10 }),
				]}
				spacing={2}
			>
				{eyebrow(label)}
				<Text
					modifiers={[
						font({ design: "rounded", size: 13, weight: "semibold" }),
						foregroundStyle(palette.ink),
						lineLimit(1),
						minimumScaleFactor(0.7),
					]}
				>
					{value}
				</Text>
			</VStack>
		</HStack>
	);

	const hero = (
		<VStack alignment="leading" spacing={1}>
			{/* Period only, never the date range: medium splits its width with the
			    chart column, and "THIS WEEK · 26 Jul - 1 Aug" truncates mid-range. */}
			{eyebrow(props.periodLabel)}
			<HStack alignment="firstTextBaseline" spacing={5}>
				<Text
					modifiers={[
						font({
							design: "rounded",
							size: isSmall ? 26 : 32,
							weight: "semibold",
						}),
						foregroundStyle(props.netPositive ? palette.income : palette.ink),
						lineLimit(1),
						minimumScaleFactor(0.5),
					]}
				>
					{props.netPositive ? props.net : `−${props.net}`}
				</Text>
				{eyebrow("NET")}
			</HStack>
		</VStack>
	);

	if (isSmall) {
		return (
			<VStack
				alignment="leading"
				modifiers={[
					widgetURL(props.url),
					containerBackground(palette.background, "widget"),
				]}
				spacing={0}
			>
				{hero}
				<Spacer />
				{bars(44, true)}
			</VStack>
		);
	}

	return (
		<HStack
			modifiers={[
				widgetURL(props.url),
				containerBackground(palette.background, "widget"),
			]}
			spacing={14}
		>
			<VStack alignment="leading" spacing={0}>
				{hero}
				<Spacer />
				<Rectangle
					modifiers={[frame({ height: 1 }), foregroundStyle(palette.border)]}
				/>
				<Spacer modifiers={[frame({ height: 8 })]} />
				<HStack spacing={0}>
					{cell("SPENT", props.spent, true)}
					{cell("IN", props.income, false)}
				</HStack>
			</VStack>

			{/* The chart column trades its day initials for the breakdown — both
			    together overflowed the column. */}
			<VStack alignment="leading" spacing={8}>
				{bars(34, false)}
				{/* The list gets its own stack rather than sitting beside `bars` as a
				    sibling array. A mapped array next to a static child in the same
				    stack renders as just the static child — the same shape the ledger
				    uses, which is the one known to survive serialization. */}
				<VStack alignment="leading" spacing={5}>
					{props.slices.slice(0, 3).map((slice) => (
						<HStack key={slice.name} spacing={6}>
							<Circle
								modifiers={[
									frame({ width: 6, height: 6 }),
									foregroundStyle(slice.color),
								]}
							/>
							<Text
								modifiers={[
									font({ design: "rounded", size: 11, weight: "medium" }),
									foregroundStyle(palette.ink),
									lineLimit(1),
								]}
							>
								{slice.name}
							</Text>
							<Spacer />
							{eyebrow(`${Math.round(slice.fraction * 100)}%`)}
						</HStack>
					))}
				</VStack>
			</VStack>
		</HStack>
	);
};

export default createWidget<InsightsWidgetProps>("Insights", InsightsWidget);
