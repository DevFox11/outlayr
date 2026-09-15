import { Circle, HStack, Rectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
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

import type { LedgerConfiguration, LedgerEntryProps, LedgerWidgetProps } from "./props";

/**
 * Runs in the widget extension's `JSContext`, so only `props`, `environment` and
 * the `@expo/ui` globals are in scope — see the note in `budget.tsx`.
 */
const LedgerWidget = (props: LedgerWidgetProps, environment: WidgetEnvironment<LedgerConfiguration>) => {
    "widget";

    const scheme = environment.colorScheme === "dark" ? "dark" : "light";
    const palette = props.chrome[scheme];
    // A configuration stored by an older build can name a period or measure this
    // one no longer offers, so both fall back rather than indexing to undefined.
    // The defaults are what the tile has always shown, so an installed widget
    // does not silently start reporting something else.
    const header =
        props.headers[environment.configuration?.period ?? "today"]?.[environment.configuration?.measure ?? "spent"] ??
        props.headers.today.spent;
    const family = environment.widgetFamily;
    const limit = family === "systemMedium" ? 3 : 8;

    // Declared inside the body, not at module scope: babel stringifies this
    // function and the extension evaluates it in a bare `JSContext`, where a
    // module-level helper resolves to nothing. It fails as a render-time
    // `ReferenceError` on the tile, never at build time.
    const signed = (entry: LedgerEntryProps) => (entry.income ? `+${entry.amount}` : entry.amount);

    // Lock Screen families render vibrant: one tint, no background, a couple of
    // lines. The colour dot and the ledger head carry nothing there, so both
    // branches drop to note-and-figure rows and let the copy do the work.
    if (family === "accessoryInline") {
        const [latest] = props.entries;
        return (
            <Text modifiers={[widgetURL(props.url)]}>
                {latest ? `${latest.note} · ${signed(latest)}` : "Nothing logged yet"}
            </Text>
        );
    }

    if (family === "accessoryRectangular") {
        const recent = props.entries.slice(0, 3);
        if (recent.length === 0) {
            return (
                <Text modifiers={[font({ design: "rounded", size: 14, weight: "medium" }), widgetURL(props.url)]}>
                    Nothing logged yet
                </Text>
            );
        }
        return (
            <VStack alignment="leading" modifiers={[widgetURL(props.url)]} spacing={1}>
                {recent.map((entry) => (
                    <HStack key={entry.id} spacing={4}>
                        <Text modifiers={[font({ design: "rounded", size: 13, weight: "medium" }), lineLimit(1)]}>
                            {entry.note}
                        </Text>
                        <Spacer />
                        <Text
                            modifiers={[
                                font({ design: "rounded", size: 13 }),
                                lineLimit(1),
                                minimumScaleFactor(0.8),
                                layoutPriority(1),
                            ]}
                        >
                            {signed(entry)}
                        </Text>
                    </HStack>
                ))}
            </VStack>
        );
    }

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

    const hairline = <Rectangle modifiers={[frame({ height: 1 }), foregroundStyle(palette.border)]} />;

    const row = (entry: LedgerEntryProps) => (
        <HStack key={entry.id} spacing={8}>
            {entry.emoji ? (
                <Text modifiers={[font({ size: 13 }), frame({ width: 16 })]}>{entry.emoji}</Text>
            ) : (
                <Circle modifiers={[frame({ height: 7, width: 7 }), foregroundStyle(entry.color)]} />
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
                {signed(entry)}
            </Text>
        </HStack>
    );

    return (
        <VStack
            alignment="leading"
            modifiers={[widgetURL(props.url), containerBackground(palette.background, "widget")]}
            spacing={0}
        >
            <HStack spacing={6}>
                {eyebrow(header.label)}
                <Spacer />
                {eyebrow(`${header.amount} ${header.positive ? "IN" : "OUT"}`)}
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

export default createWidget<LedgerWidgetProps, LedgerConfiguration>("Ledger", LedgerWidget);
