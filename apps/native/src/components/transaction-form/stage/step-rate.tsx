import type { EntryRateType } from "@outlayr/money/rates";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { TransactionRateSuggestions } from "@/data/transaction-entry-rates";
import {
    effectiveEntryRate,
    formatEntryRate,
    transactionRateError,
    transactionRateOptions,
} from "@/domain/transaction-entry-rate";
import type { TransactionEntryRate, TransactionRateError } from "@/domain/transaction-entry-rate";

import { Text } from "../../text";
import { cn } from "../../tw";

export interface StepRateLabels {
    custom: string;
    editCustom: string;
    /** Inline danger copy, one per `transactionRateError` code. */
    error: Record<NonNullable<TransactionRateError>, string>;
    eurReference: string;
    official: string;
    /** Unit beside the promoted figure, e.g. "VES per USD". */
    perUsd: string;
    requiredHint: string;
    /** Placeholder for a rate the user can still type. */
    set: string;
    title: string;
    /**
     * Placeholder for a provider rate that does not exist. Rates resolve per
     * currency AND per date over a rolling window, so outside it the lookup
     * genuinely returns nothing — the option must say so rather than show the
     * last figure it happens to remember.
     */
    unavailable: string;
}

export interface StepRateProps {
    /** The custom-rate keypad. Rendered beneath only while `custom` is selected. */
    children?: ReactNode;
    currency: string;
    labels: StepRateLabels;
    onEditCustom: () => void;
    onSelectType: (type: EntryRateType) => void;
    onUseSuggestion: (rate: number, type: EntryRateType) => void;
    /** Already-formatted date the rates were resolved for. */
    resolvedOn: string;
    selection: TransactionEntryRate;
    suggestions: TransactionRateSuggestions;
}

const labelFor = (type: EntryRateType, labels: StepRateLabels): string => {
    if (type === "eur_reference") {
        return labels.eurReference;
    }
    return type === "custom" ? labels.custom : labels.official;
};

/**
 * The rate each option would apply if tapped. Custom offers the prior custom rate
 * when there is one, so repeating last month's rate stays a single tap.
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

/**
 * A missing provider rate and an unentered custom rate are different absences:
 * one can never be typed, the other is waiting to be.
 */
const figureFor = (type: EntryRateType, rate: number | null, labels: StepRateLabels): string => {
    if (rate !== null) {
        return formatEntryRate(rate);
    }
    return type === "custom" ? labels.set : labels.unavailable;
};

/**
 * The rate step's body: the selected option promoted as a figure with its unit,
 * the rest as hairline-divided columns beneath. A rate never blocks a save, so
 * nothing here is required and nothing is disabled for want of one.
 */
export function StepRate({
    children,
    currency,
    labels,
    onEditCustom,
    onSelectType,
    onUseSuggestion,
    resolvedOn,
    selection,
    suggestions,
}: StepRateProps) {
    const options = transactionRateOptions(currency);
    if (options.length === 0) {
        return null;
    }

    const selected = selection.exchangeRateType;
    const heroRate = effectiveEntryRate(selection, suggestions);
    const isCustom = selected === "custom";
    // A custom policy with no rate yet still has last month's rate to offer. It is
    // shown muted because, unlike `heroRate`, it is NOT what the entry would record
    // until tapped.
    const offeredRate = heroRate === null && isCustom ? (suggestions.priorCustom?.rate ?? null) : null;
    const heroFigure = heroRate ?? offeredRate;
    const alternates = options.filter((type) => type !== selected);
    const errorCode = transactionRateError(currency, selection);

    // Tapping an alternate promotes it. A provider rate applies its suggestion
    // outright; custom applies the prior rate when there is one, and otherwise
    // opens the pad.
    const promote = (type: EntryRateType) => {
        const rate = rateFor(type, selection, suggestions);
        if (rate !== null) {
            onUseSuggestion(rate, type);
            return;
        }
        onSelectType(type);
    };

    // Pressing the promoted figure edits a custom rate, and for a provider policy
    // freezes the rate currently shown so the entry records that exact value
    // instead of resolving it again later.
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
        <View className="gap-3">
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
                <Text className="text-eyebrow text-muted tracking-eyebrow font-mono uppercase">{labels.title}</Text>
                <View className="flex-row items-baseline gap-2">
                    <Text
                        className={cn(
                            "font-mono-medium text-title tabular-nums",
                            heroRate === null ? "text-muted" : "text-foreground"
                        )}
                    >
                        {figureFor(selected, heroFigure, labels)}
                    </Text>
                    {heroFigure === null ? null : <Text className="text-footnote text-muted">{labels.perUsd}</Text>}
                </View>
                <Text className="text-footnote text-muted font-mono">
                    {`${labelFor(selected, labels)} · ${resolvedOn}`}
                </Text>
            </Pressable>

            {errorCode === null ? null : (
                <View>
                    <Text className="text-danger text-subtitle">{labels.error[errorCode]}</Text>
                    <Text className="text-footnote text-muted">{labels.requiredHint}</Text>
                </View>
            )}

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
                                    rate === null ? undefined : { text: `${formatEntryRate(rate)} ${labels.perUsd}` }
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
                                        "font-mono-medium text-callout tabular-nums",
                                        rate === null ? "text-muted" : "text-foreground"
                                    )}
                                >
                                    {figureFor(type, rate, labels)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            )}

            {isCustom ? children : null}
        </View>
    );
}
