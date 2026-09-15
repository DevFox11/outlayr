import { Fragment } from "react";
import { View } from "react-native";

import { rowAmountLabel } from "@/domain/amount-label";
import type { RowAmountLabelInput } from "@/domain/amount-label";
import type { CurrencyBucket } from "@/domain/currency-totals";
import { amountParts, formatAmount, splitSymbol } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

import { Text } from "./text";
import { cn, tv } from "./tw";

interface HeroNumberProps {
    /** Signed magnitude; the sign shown is derived unless `sign` is given. */
    amount: number;
    code: string;
    /** Mirrors the "Display Cents" setting; false rounds to whole units. */
    showCents?: boolean;
    sign?: "+" | "-" | "";
    size?: number;
    /** uniwind color class for the digits, e.g. "text-income". */
    toneClass?: string;
}

/** Nested `Text` baseline-aligns the parts without manual layout. */
export function HeroNumber({
    amount,
    code,
    sign,
    toneClass = "text-foreground",
    size = 40,
    showCents = true,
}: HeroNumberProps) {
    // Read through the context rather than `amountParts`' `runtimeLanguage()`
    // default: the default is a module global React cannot see, so a component
    // that reads it without also consuming this context is bailed out of the
    // re-render when the language changes and keeps printing the old locale.
    const { language } = useLanguage();
    const parts = amountParts(amount, code, showCents, language);
    const resolvedSign = sign ?? (amount < 0 ? "-" : "+");
    const small = Math.round(size * 0.5);
    const { prefixSymbol, suffixSymbol } = splitSymbol(parts);
    return (
        <Text
            adjustsFontSizeToFit
            className={cn("tracking-hero font-sans tabular-nums", toneClass)}
            numberOfLines={1}
            style={{ fontSize: size }}
        >
            <Text className="text-muted font-sans" style={{ fontSize: small }}>
                {resolvedSign}
                {prefixSymbol}
            </Text>
            {parts.integer}
            {parts.fraction ? (
                <Text className="text-muted font-sans" style={{ fontSize: small }}>
                    {parts.locale.decimal}
                    {parts.fraction}
                </Text>
            ) : null}
            {suffixSymbol ? (
                <Text className="text-muted font-sans" style={{ fontSize: small }}>
                    {suffixSymbol}
                </Text>
            ) : null}
        </Text>
    );
}

/**
 * Order matters: `isFuture` is declared after `income`, so a future-dated income
 * row resolves to `text-future` once `tv`'s merge drops the earlier colour.
 */
const rowAmount = tv({
    base: "font-sans-medium text-foreground text-title",
    variants: {
        income: { true: "text-income" },
        isFuture: { true: "text-future" },
        struck: { true: "line-through" },
    },
});

interface RowAmountProps extends RowAmountLabelInput {
    isFuture: boolean;
    /** The import review's excluded state: still legible, visibly not counted. */
    struck?: boolean;
    transfer?: boolean;
}

function signFor(income: boolean | null): "+" | "-" {
    return income ? "+" : "-";
}

export function RowAmount({
    amount,
    income,
    isFuture,
    code,
    showCents = true,
    struck = false,
    transfer = false,
}: RowAmountProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const sign = transfer ? "" : signFor(income);
    return (
        <Text
            // Spelled out because neither the glyph nor the colour is a cue a screen
            // reader can read; `rowAmountLabel` owns the wording.
            accessibilityLabel={rowAmountLabel({ amount, code, income: transfer ? null : income, showCents }, t)}
            className={cn(rowAmount({ income: !transfer && income === true, isFuture, struck }), "tabular-nums")}
            numberOfLines={1}
        >
            {sign}
            {formatAmount(amount, code, showCents, language)}
        </Text>
    );
}

interface MeasureCellAmountProps {
    code: string;
    /** True only for the "In" measure — the one figure that earns the income color. */
    income: boolean;
    /** Unsigned magnitude; the sign comes from `positive`, not from this. */
    magnitude: number;
    positive: boolean;
    /** Mirrors the "Display Cents" setting; false rounds to whole units. */
    showCents?: boolean;
}

/** Symbol, sign and digits share one tone, unlike the hero's muted symbol. */
export function MeasureCellAmount({ magnitude, positive, income, code, showCents = true }: MeasureCellAmountProps) {
    const { language } = useLanguage();
    const toneClass = income ? "text-income" : "text-foreground";
    const sign = positive ? "+" : "-";
    return (
        <Text className={cn("font-sans-semibold text-body tabular-nums", toneClass)} numberOfLines={1}>
            {sign}
            {formatAmount(magnitude, code, showCents, language)}
        </Text>
    );
}

interface DayTotalProps {
    /** Mirrors the "Display Cents" setting; false rounds to whole units. */
    showCents?: boolean;
    /** The Upcoming header runs a step larger than a day header's. */
    sizeClass?: string;
    /** Signed totals per currency, dominant first. */
    totals: readonly CurrencyBucket[];
}

function signedAmount(amount: number, code: string, showCents: boolean, language: Language): string {
    return `${amount < 0 ? "-" : "+"}${formatAmount(amount, code, showCents, language)}`;
}

/**
 * A day that spent two currencies gets two figures separated by a slash, never
 * added: there is no rate here, so a single number would be an invention.
 */
export function DayTotal({ totals, showCents = true, sizeClass = "text-footnote" }: DayTotalProps) {
    const { language } = useLanguage();
    return (
        <View className="flex-row items-baseline gap-1.5">
            {totals.map((bucket, index) => (
                <Fragment key={bucket.currencyCode}>
                    {index > 0 ? <Text className={cn("font-sans-semibold text-subtle", sizeClass)}>/</Text> : null}
                    <Text className={cn("font-sans-semibold text-muted tabular-nums", sizeClass)} numberOfLines={1}>
                        {signedAmount(bucket.amount, bucket.currencyCode, showCents, language)}
                    </Text>
                </Fragment>
            ))}
        </View>
    );
}
