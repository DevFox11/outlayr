import { RNHostView } from "@expo/ui/swift-ui";
import type { EntryRateType } from "@outlayr/money/rates";
import { Pressable, View } from "react-native";

import type { TransactionRateSuggestions } from "@/data/transaction-entry-rates";
import { effectiveEntryRate, formatEntryRate, transactionRateOptions } from "@/domain/transaction-entry-rate";
import type { TransactionEntryRate } from "@/domain/transaction-entry-rate";
import { useColors } from "@/theme/use-colors";

import { Text } from "../text";
import { cn } from "../tw";

export interface TransactionFormRateLabels {
    conversion: string | null;
    custom: string;
    editCustom: string;
    eurReference: string;
    official: string;
    pendingBody: string;
    pendingTitle: string;
    perUsd: string;
    required: string;
    requiredHint: string;
    set: string;
    title: string;
}

interface TransactionFormRateSectionProps {
    /**
     * Width of the enclosing SwiftUI VStack's content box. `RNHostView matchContents`
     * resolves percentage widths against the SCREEN, not the padded parent, so this
     * has to be pinned explicitly or the section bleeds past the form's margins.
     */
    contentWidth: number;
    currency: string;
    error: string | null;
    labels: TransactionFormRateLabels;
    onEditCustom: () => void;
    onSelectType: (type: EntryRateType) => void;
    onUseSuggestion: (rate: number, type: EntryRateType) => void;
    pending: boolean;
    selection: TransactionEntryRate;
    suggestions: TransactionRateSuggestions;
}

const labelFor = (type: EntryRateType, labels: TransactionFormRateLabels): string => {
    if (type === "eur_reference") {
        return labels.eurReference;
    }
    return type === "custom" ? labels.custom : labels.official;
};

/**
 * The rate each option would apply if tapped. Custom offers the prior custom rate when
 * there is one, so repeating last month's rate stays a single tap.
 */
const rateFor = (
    type: EntryRateType,
    selection: TransactionEntryRate,
    suggestions: TransactionRateSuggestions
): number | null => {
    if (type === "official") {
        return suggestions.official;
    }
    if (type === "eur_reference") {
        return suggestions.eurReference;
    }
    return selection.exchangeRateType === "custom" && selection.exchangeRate !== null
        ? selection.exchangeRate
        : (suggestions.priorCustom?.rate ?? null);
};

export function TransactionFormRateSection({
    contentWidth,
    currency,
    selection,
    suggestions,
    labels,
    error,
    pending,
    onSelectType,
    onUseSuggestion,
    onEditCustom,
}: TransactionFormRateSectionProps) {
    const colors = useColors();
    const options = transactionRateOptions(currency);
    if (options.length === 0) {
        return null;
    }

    const selected = selection.exchangeRateType;
    const heroRate = effectiveEntryRate(selection, suggestions);
    const isCustom = selected === "custom";
    // A custom policy with no rate yet still has last month's rate to offer. It is shown
    // muted because, unlike `heroRate`, it is NOT what the entry would record until tapped.
    const offeredRate = heroRate === null && isCustom ? (suggestions.priorCustom?.rate ?? null) : null;
    const heroFigure = heroRate ?? offeredRate;
    const alternates = options.filter((type) => type !== selected);

    // Tapping an alternate promotes it. A provider rate applies its suggestion outright;
    // custom applies the prior rate when there is one, and otherwise opens the pad.
    const promote = (type: EntryRateType) => {
        const rate = rateFor(type, selection, suggestions);
        if (type !== "custom" && rate !== null) {
            onUseSuggestion(rate, type);
            return;
        }
        if (type === "custom" && rate !== null) {
            onUseSuggestion(rate, "custom");
            return;
        }
        onSelectType(type);
    };

    // Pressing the promoted figure edits a custom rate, and for a provider policy freezes
    // the rate currently shown so the entry records that exact value instead of resolving
    // it again later.
    const pressHero = () => {
        if (offeredRate !== null) {
            onUseSuggestion(offeredRate, "custom");
            return;
        }
        if (isCustom) {
            onEditCustom();
            return;
        }
        if (heroRate !== null) {
            onUseSuggestion(heroRate, selected);
        }
    };

    return (
        <RNHostView matchContents>
            <View className="gap-3 py-1" style={{ width: contentWidth }}>
                <Pressable
                    accessibilityHint={isCustom ? labels.requiredHint : undefined}
                    accessibilityLabel={
                        isCustom && heroFigure === null
                            ? labels.editCustom
                            : `${labels.title} · ${labelFor(selected, labels)}`
                    }
                    accessibilityRole="button"
                    accessibilityValue={
                        heroFigure === null ? undefined : { text: `${formatEntryRate(heroFigure)} ${labels.perUsd}` }
                    }
                    disabled={!isCustom && heroRate === null}
                    onPress={pressHero}
                    style={{ minHeight: 44 }}
                >
                    <Text className="text-eyebrow text-muted tracking-eyebrow font-mono uppercase">
                        {`${labels.title} · ${labelFor(selected, labels)}`}
                    </Text>
                    <View className="flex-row items-baseline gap-2">
                        <Text
                            className={cn(
                                "font-sans-semibold text-title tabular-nums",
                                heroRate === null ? "text-muted" : "text-foreground"
                            )}
                        >
                            {heroFigure === null ? labels.set : formatEntryRate(heroFigure)}
                        </Text>
                        {heroFigure === null ? null : <Text className="text-footnote text-muted">{labels.perUsd}</Text>}
                    </View>
                    {labels.conversion === null ? null : (
                        <Text className="text-footnote text-muted tabular-nums">{labels.conversion}</Text>
                    )}
                    {error ? <Text className="text-danger text-subtitle">{error}</Text> : null}
                    {error ? <Text className="text-footnote text-muted">{labels.requiredHint}</Text> : null}
                </Pressable>

                {alternates.length === 0 ? null : (
                    <View className="border-border flex-row border-t">
                        {alternates.map((type, index) => {
                            const rate = rateFor(type, selection, suggestions);
                            const label = labelFor(type, labels);
                            return (
                                <Pressable
                                    accessibilityLabel={label}
                                    accessibilityRole="button"
                                    accessibilityValue={
                                        rate === null
                                            ? undefined
                                            : { text: `${formatEntryRate(rate)} ${labels.perUsd}` }
                                    }
                                    className={cn(
                                        "min-w-0 flex-1 pt-2.5 active:opacity-60",
                                        index > 0 && "border-border border-l pl-3.5"
                                    )}
                                    key={type}
                                    onPress={() => promote(type)}
                                    style={{ minHeight: 44 }}
                                >
                                    <Text className="text-eyebrow text-muted tracking-eyebrow font-mono uppercase">
                                        {label}
                                    </Text>
                                    <Text
                                        className={cn(
                                            "font-sans-medium text-callout tabular-nums",
                                            rate === null ? "text-muted" : "text-foreground"
                                        )}
                                    >
                                        {rate === null ? labels.set : formatEntryRate(rate)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {pending ? (
                    <View className="border-warning gap-1 border-l-2 py-1 pl-3">
                        <Text className="font-sans-semibold text-callout" style={{ color: colors.warning }}>
                            {labels.pendingTitle}
                        </Text>
                        <Text accessibilityLiveRegion="polite" className="text-muted text-subtitle">
                            {labels.pendingBody}
                        </Text>
                    </View>
                ) : null}
            </View>
        </RNHostView>
    );
}
