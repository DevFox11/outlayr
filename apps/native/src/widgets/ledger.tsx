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
	layoutPriority,
	lineLimit,
	minimumScaleFactor,
	widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";
import { createWidget } from "expo-widgets";
import type { LedgerEntryProps, LedgerWidgetProps } from "./props";

/**
 * Runs in the widget extension's `JSContext`, so only `props`, `environment` and
 * the `@expo/ui` globals are in scope — see the note in `budget.tsx`.
 */
const LedgerWidget = (
	props: LedgerWidgetProps,
	environment: WidgetEnvironment,
) => {
	"widget";

	const scheme = environment.colorScheme === "dark" ? "dark" : "light";
	const palette = props.chrome[scheme];
	// Declared inside the body, not at module scope: babel stringifies this
	// function and the extension evaluates it in a bare `JSContext`, where a
	// module-level constant resolves to nothing. It fails as a render-time
	// `ReferenceError` on the tile, never at build time.
	const mediumRows = 3;
	const limit = environment.widgetFamily === "systemMedium" ? mediumRows : 8;
	const entries = props.entries.slice(0, limit);

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

	const hairline = (
		<Rectangle
			modifiers={[frame({ height: 1 }), foregroundStyle(palette.border)]}
		/>
	);

	const row = (entry: LedgerEntryProps) => (
		<HStack key={entry.id} spacing={8}>
			{entry.emoji ? (
				<Text modifiers={[font({ size: 13 }), frame({ width: 16 })]}>
					{entry.emoji}
				</Text>
			) : (
				<Circle
					modifiers={[
						frame({ width: 7, height: 7 }),
						foregroundStyle(entry.color),
					]}
				/>
			)}
			<VStack alignment="leading" spacing={1}>
				<Text
					modifiers={[
						font({ design: "rounded", size: 14, weight: "medium" }),
						foregroundStyle(palette.ink),
						lineLimit(1),
					]}
				>
					{entry.note}
				</Text>
			</VStack>
			<Spacer />
			{/* `layoutPriority` so a long merchant name truncates before the
			    figure does. */}
			<Text
				modifiers={[
					font({ design: "rounded", size: 14, weight: "semibold" }),
					foregroundStyle(entry.income ? palette.income : palette.ink),
					lineLimit(1),
					minimumScaleFactor(0.7),
					layoutPriority(1),
				]}
			>
				{entry.income ? `+${entry.amount}` : entry.amount}
			</Text>
		</HStack>
	);

	return (
		<VStack
			alignment="leading"
			modifiers={[
				widgetURL(props.url),
				containerBackground(palette.background, "widget"),
			]}
			spacing={0}
		>
			<HStack spacing={6}>
				{eyebrow(props.todayLabel)}
				<Spacer />
				{eyebrow(`${props.todaySpent} OUT`)}
			</HStack>
			<Spacer modifiers={[frame({ height: 8 })]} />
			{hairline}
			<Spacer modifiers={[frame({ height: 8 })]} />

			{entries.length === 0 ? (
				<Text
					modifiers={[
						font({ design: "rounded", size: 15, weight: "medium" }),
						foregroundStyle(palette.muted),
					]}
				>
					Nothing logged yet.
				</Text>
			) : (
				<VStack alignment="leading" spacing={10}>
					{entries.map(row)}
				</VStack>
			)}
			<Spacer />
		</VStack>
	);
};

export default createWidget<LedgerWidgetProps>("Ledger", LedgerWidget);
