import { roundMoney } from "@outlayr/money/round";
import { NumberFlow } from "number-flow-react-native";
import { Fragment, use } from "react";
import { useWindowDimensions, View } from "react-native";
import { Easing } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { amountHeroFontSize } from "@/domain/amount-hero-size";
import { rowAmountLabel } from "@/domain/amount-label";
import type { RowAmountLabelInput } from "@/domain/amount-label";
import type { CurrencyBucket } from "@/domain/currency-totals";
import { amountDigits, amountParts, formatAmount, withCurrencySymbol } from "@/domain/money";
import type { NumberLocale } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

import { FontScaleCapContext, Text } from "./text";
import { cn, tv } from "./tw";

const BASELINE_STRUT = "\u200B";
const HERO_GUTTER = 40;
const SNAP_WIDTH = { duration: 0, easing: Easing.linear };

function intlDecimal(tag: string): string {
    return new Intl.NumberFormat(tag, { minimumFractionDigits: 1, useGrouping: false }).format(1.5).charAt(1);
}

interface FlowFigureProps {
    className?: string;
    format: Intl.NumberFormatOptions;
    locale: NumberLocale;
    prefix?: string;
    size?: number;
    snapWidth?: boolean;
    value: number;
}

export function FlowFigure({ className, format, locale, prefix, size, snapWidth, value }: FlowFigureProps) {
    const { color, fontFamily, fontSize, fontVariant } = useResolveClassNames(className ?? "");
    const fontScaleCap = use(FontScaleCapContext);
    const { fontScale } = useWindowDimensions();
    const figureSize = size ?? fontSize;
    const overCap = figureSize !== undefined && fontScaleCap !== undefined && fontScale > fontScaleCap;
    return (
        <View className="flex-row items-center">
            <Text accessible={false} className={className} style={size == null ? undefined : { fontSize: size }}>
                {BASELINE_STRUT}
            </Text>
            <NumberFlow
                format={format}
                locales={locale.tag}
                prefix={prefix}
                style={{
                    color,
                    fontFamily,
                    fontSize: overCap ? (figureSize * fontScaleCap) / fontScale : figureSize,
                    fontVariant,
                }}
                transformTiming={snapWidth ? SNAP_WIDTH : undefined}
                value={value}
            />
        </View>
    );
}

interface FlowAmountProps {
    amount: number;
    className?: string;
    code: string;
    prefix?: string;
    showCents: boolean;
    size?: number;
    snapWidth?: boolean;
}

export function FlowAmount({ amount, className, code, prefix, showCents, size, snapWidth }: FlowAmountProps) {
    const { language } = useLanguage();
    const { locale, minorUnits } = amountParts(amount, code, showCents, language);
    return (
        <FlowFigure
            className={className}
            format={{ maximumFractionDigits: minorUnits, minimumFractionDigits: minorUnits, useGrouping: true }}
            locale={locale}
            prefix={prefix}
            size={size}
            snapWidth={snapWidth}
            value={roundMoney(Math.abs(amount), minorUnits)}
        />
    );
}

export function fittedHeroSize(size: number, amount: number, minorUnits: number, width: number): number {
    return width > 0 ? Math.min(size, Math.floor(amountHeroFontSize(amount, minorUnits, width))) : size;
}

interface HeroNumberProps {
    /** Signed magnitude; the sign shown is derived unless `sign` is given. */
    amount: number;
    code: string;
    /** Mirrors the "Display Cents" setting; false rounds to whole units. */
    showCents?: boolean;
    sign?: "+" | "-" | "";
    size?: number;
    snapWidth?: boolean;
    /** uniwind color class for the digits, e.g. "text-income". */
    toneClass?: string;
}

export function HeroNumber({
    amount,
    code,
    sign,
    toneClass = "text-foreground",
    size = 40,
    snapWidth,
    showCents = true,
}: HeroNumberProps) {
    // Read through the context rather than `amountParts`' `runtimeLanguage()`
    // default: the default is a module global React cannot see, so a component
    // that reads it without also consuming this context is bailed out of the
    // re-render when the language changes and keeps printing the old locale.
    const { language } = useLanguage();
    const { width: windowWidth } = useWindowDimensions();
    const parts = amountParts(amount, code, showCents, language);
    const resolvedSign = sign ?? (amount < 0 ? "-" : "+");
    const fitted = fittedHeroSize(size, amount, parts.minorUnits, windowWidth - HERO_GUTTER);
    const small = (Math.round(size * 0.5) * fitted) / size;
    const whole = Math.trunc(roundMoney(Math.abs(amount), parts.minorUnits));
    return (
        <View
            accessibilityLabel={`${resolvedSign}${withCurrencySymbol(parts, amountDigits(parts))}`}
            accessibilityRole="text"
            accessible
            className="flex-row items-baseline"
        >
            <Text
                className="tracking-hero text-muted font-sans tabular-nums"
                numberOfLines={1}
                style={{ fontSize: small }}
            >
                {resolvedSign}
                {parts.symbol}
            </Text>
            <FlowFigure
                className={cn("font-sans tabular-nums", toneClass)}
                format={{ maximumFractionDigits: 0, useGrouping: true }}
                locale={parts.locale}
                size={fitted}
                snapWidth={snapWidth}
                value={whole}
            />
            {parts.fraction ? (
                <FlowFigure
                    className="text-muted font-sans tabular-nums"
                    format={{ minimumIntegerDigits: parts.minorUnits, useGrouping: false }}
                    locale={parts.locale}
                    prefix={intlDecimal(parts.locale.tag)}
                    size={small}
                    snapWidth={snapWidth}
                    value={Number(parts.fraction)}
                />
            ) : null}
        </View>
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
