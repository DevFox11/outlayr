import { Gauge, HStack, ProgressView, Rectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
	containerBackground,
	font,
	foregroundStyle,
	frame,
	gaugeStyle,
	lineLimit,
	minimumScaleFactor,
	padding,
	progressViewStyle,
	tint,
	widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";
import { createWidget } from "expo-widgets";
import type { BudgetConfiguration, BudgetWidgetProps } from "./props";

/**
 * Everything inside the function body runs in the widget extension's own
 * `JSContext` — babel stringifies it and `expo-widgets` evaluates it there — so
 * only `props`, `environment`, the `@expo/ui` globals and locals declared inside
 * are in scope. Nothing from this repo's module scope reaches it, which is why
 * every figure arrives preformatted and every colour arrives as hex (see
 * `props.ts` and `palette.ts`).
 *
 * No widget here sets its own outer padding. WidgetKit already insets the
 * content by the system's default margins (~16pt, tuned per device and family),
 * so anything added on top is *additive* — a 14pt pad spent roughly 38% of a
 * small tile's width on whitespace. `environment.widgetContentMargins` reports
 * the system inset if a layout ever needs the number.
 */
const BudgetWidget = (props: BudgetWidgetProps, environment: WidgetEnvironment<BudgetConfiguration>) => {
	"widget";

	const scheme = environment.colorScheme === "dark" ? "dark" : "light";
	const palette = props.chrome[scheme];
	const family = environment.widgetFamily;
	// A configuration stored by an older build can name a view this one no longer
	// publishes, and an undefined view renders as a blank tile with no error.
	const view = props.views[environment.configuration?.budget ?? "auto"] ?? props.views.auto;
	const accent = view.over ? palette.over : palette.ink;

	// Lock Screen families render vibrant — the system flattens everything to a
	// single tint, so colour carries no meaning there and the copy has to.
	const isAccessory =
		family === "accessoryCircular" || family === "accessoryRectangular" || family === "accessoryInline";

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

	if (family === "accessoryInline") {
		return (
			<Text modifiers={[widgetURL(view.url)]}>
				{view.present
					? `${view.isOverall ? "" : `${view.name}: `}${view.remaining} ${view.remainingCaption.toLowerCase()} · ${view.percent}`
					: "No budget yet"}
			</Text>
		);
	}

	if (family === "accessoryCircular") {
		return (
			<Gauge
				max={1}
				min={0}
				modifiers={[gaugeStyle("circularCapacity"), widgetURL(view.url)]}
				value={view.spentFraction}
			>
				<Text>{view.present ? view.percent : "—"}</Text>
			</Gauge>
		);
	}

	if (!view.present) {
		return (
			<VStack modifiers={[widgetURL(view.url), containerBackground(palette.background, "widget")]} spacing={4}>
				{eyebrow("BUDGET")}
				<Text modifiers={[font({ design: "rounded", size: 15, weight: "medium" }), foregroundStyle(palette.muted)]}>
					Set a budget to see it here.
				</Text>
			</VStack>
		);
	}

	// `minimumScaleFactor` rather than a smaller type size: the hero has to hold
	// both "$9.20" and "$12,480" in the same box.
	const hero = (size: number) => (
		<HStack alignment="firstTextBaseline" spacing={5}>
			<Text
				modifiers={[
					font({ design: "rounded", size, weight: "semibold" }),
					foregroundStyle(isAccessory ? palette.ink : accent),
					lineLimit(1),
					minimumScaleFactor(0.5),
				]}
			>
				{view.remaining}
			</Text>
			<Text
				modifiers={[
					font({ design: "monospaced", size: 10, weight: "medium" }),
					foregroundStyle(palette.muted),
					lineLimit(1),
				]}
			>
				{view.remainingCaption}
			</Text>
		</HStack>
	);

	const rail = <ProgressView modifiers={[progressViewStyle("linear"), tint(accent)]} value={view.spentFraction} />;

	if (family === "accessoryRectangular") {
		return (
			<VStack alignment="leading" modifiers={[widgetURL(view.url)]} spacing={2}>
				{eyebrow(
					view.isOverall ? `${view.periodLabel} · ${view.percent}` : `${view.name.toUpperCase()} · ${view.percent}`
				)}
				{hero(20)}
				{rail}
			</VStack>
		);
	}

	/** The app's `LedgerHead` shape: cells under a hairline, split by rules. */
	const cell = (label: string, value: string, leading: boolean) => (
		<HStack spacing={0}>
			{leading ? null : <Rectangle modifiers={[frame({ width: 1 }), foregroundStyle(palette.border)]} />}
			<VStack
				alignment="leading"
				modifiers={[
					frame({ alignment: "leading", maxWidth: Number.POSITIVE_INFINITY }),
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

	return (
		<VStack
			alignment="leading"
			modifiers={[widgetURL(view.url), containerBackground(palette.background, "widget")]}
			spacing={0}
		>
			{/* A per-category budget leads with its own name, or the tile is
			    indistinguishable from the overall one. */}
			{eyebrow(
				view.isOverall
					? family === "systemSmall"
						? view.periodLabel
						: `${view.periodLabel} · ${view.rangeLabel}`
					: `${view.name.toUpperCase()} · ${view.periodLabel}`
			)}
			<Spacer modifiers={[frame({ height: 6 })]} />
			{hero(family === "systemSmall" ? 26 : 32)}
			<Spacer modifiers={[frame({ height: 10 })]} />
			{rail}
			<Spacer />
			<Rectangle modifiers={[frame({ height: 1 }), foregroundStyle(palette.border)]} />
			<Spacer modifiers={[frame({ height: 8 })]} />
			<HStack spacing={0}>
				{cell("SPENT", view.spent, true)}
				{cell("LIMIT", view.limit, false)}
				{family === "systemSmall" ? null : cell("ELAPSED", `${Math.round(view.elapsedFraction * 100)}%`, false)}
			</HStack>
		</VStack>
	);
};

export default createWidget<BudgetWidgetProps, BudgetConfiguration>("Budget", BudgetWidget);
