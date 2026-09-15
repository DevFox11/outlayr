import { MenuView } from "@expo/ui/community/menu";
import ArrowDown01Icon from "@hugeicons-pro/core-solid-rounded/ArrowDown01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { View } from "react-native";

import { LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { LogInsights as LogInsightsData, LogPeriod } from "@/data/log-totals";
import { measureIsIncome, measureIsPositive, measureMagnitude } from "@/domain/log-measure";
import type { LogFigures, LogMeasure } from "@/domain/log-measure";
import type { SparklinePoint } from "@/domain/log-sparkline";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

import { measureCells, MEASURE_WORD_KEY, PERIOD_PHRASE_KEY } from "../labels";
import { LogHeroNumber } from "./log-hero-number";
import { LogSparkline } from "./log-sparkline";

interface LogInsightsProps {
    /** What the chip offers, ledger currency first — see `logCurrencyOptions`. */
    currencyOptions: readonly string[];
    /** The currency the whole screen is being read in. */
    displayCurrency: string;
    insights: LogInsightsData;
    measure: LogMeasure;
    /** Null puts the screen back in the ledger's own currency. */
    onDisplayCurrency: (code: string | null) => void;
    /**
     * Opens the screen that curates favourites. Without a route in from here, a
     * ledger kept in one currency offers a single option and the chip is a control
     * that cannot do anything.
     */
    onManageCurrencies: () => void;
    onMeasure: (measure: LogMeasure) => void;
    period: LogPeriod;
    sparkline?: SparklineData | null;
}

export interface SparklineData {
    byMonth: boolean;
    points: SparklinePoint[];
    positive: boolean;
    range: number;
}

/**
 * Nothing here does currency arithmetic — `useLogInsights` buckets, and this
 * picks a bucket and renders it.
 */
export function LogInsights({
    insights,
    measure,
    onMeasure,
    period,
    displayCurrency,
    currencyOptions,
    onDisplayCurrency,
    onManageCurrencies,
    sparkline = null,
}: LogInsightsProps) {
    const { showCents } = useDisplaySettings().state;
    const t = useTranslation();
    // The buckets are already expressed in `displayCurrency`; it only fails to
    // name one when nothing in the period could be placed there.
    const figures = insights.perCurrency.find((f) => f.currencyCode === displayCurrency) ?? insights.dominant;
    const alsoThisPeriod = insights.perCurrency.filter((f) => f.currencyCode !== figures.currencyCode);

    return (
        <View className="pt-3.5 pb-1.5">
            <View className="flex-row items-baseline gap-2.5">
                <MonoLabel>{`${t(MEASURE_WORD_KEY[measure])} · ${t(PERIOD_PHRASE_KEY[period])}`}</MonoLabel>
                <View className="flex-1" />
                <DisplayCurrencyChip
                    // The figures' own currency, not the requested one: when nothing in
                    // the period could be placed in `displayCurrency` the numbers fall
                    // back to the dominant bucket, and a chip still naming the request
                    // would label the screen as something it is not.
                    code={figures.currencyCode}
                    onManage={onManageCurrencies}
                    onSelect={(code) =>
                        // The list leads with the ledger's own currency, so choosing it is
                        // the way out of an override rather than an override onto itself.
                        onDisplayCurrency(code === currencyOptions[0] ? null : code)
                    }
                    options={currencyOptions}
                />
            </View>

            <View className="pt-1">
                <LogHeroNumber
                    code={figures.currencyCode}
                    magnitude={measureMagnitude(measure, figures)}
                    positive={measureIsPositive(measure, figures)}
                    showCents={showCents}
                />
            </View>

            <View className="pt-3">
                <LedgerHead cells={measureCells(measure, figures, t, onMeasure)} code={figures.currencyCode} />
            </View>

            {alsoThisPeriod.length > 0 ? (
                <View className="gap-2 pt-3">
                    <View className="pb-0.75">
                        <View className="bg-border h-px w-full" />
                    </View>
                    <MonoLabel>{t("log.insights.also", { period: t(PERIOD_PHRASE_KEY[period]) })}</MonoLabel>
                    <View className="flex-row flex-wrap gap-1.5">
                        {alsoThisPeriod.map((entry) => (
                            <AlsoPill
                                figures={entry}
                                key={entry.currencyCode}
                                measure={measure}
                                showCents={showCents}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            {sparkline && sparkline.points.length > 1 ? (
                <LogSparkline
                    byMonth={sparkline.byMonth}
                    code={figures.currencyCode}
                    measure={measure}
                    points={sparkline.points}
                    positive={sparkline.positive}
                    range={sparkline.range}
                />
            ) : null}
        </View>
    );
}

function AlsoPill({ figures, measure, showCents }: { figures: LogFigures; measure: LogMeasure; showCents: boolean }) {
    const { language } = useLanguage();

    const sign = measureIsPositive(measure, figures) ? "+" : "-";
    const amount = `${sign}${formatAmount(measureMagnitude(measure, figures), figures.currencyCode, showCents, language)}`;

    return (
        <View
            accessibilityLabel={`${figures.currencyCode}, ${amount}`}
            accessible
            className="bg-surface-secondary flex-row items-center gap-1.5 rounded-[7px] px-2 py-1"
        >
            <MonoLabel>{figures.currencyCode}</MonoLabel>
            <Text
                className={cn(
                    "tabular-nums",
                    "font-sans-semibold text-footnote",
                    measureIsIncome(measure) ? "text-income" : "text-foreground"
                )}
                numberOfLines={1}
            >
                {amount}
            </Text>
        </View>
    );
}

/**
 * Namespaced so it cannot collide with a currency code, which is what every
 * other action in this menu is identified by.
 */
const MANAGE_CURRENCIES_ACTION = "log.currency.manage";

function DisplayCurrencyChip({
    code,
    options,
    onSelect,
    onManage,
}: {
    code: string;
    options: readonly string[];
    onSelect: (code: string) => void;
    onManage: () => void;
}) {
    const t = useTranslation();
    return (
        <MenuView
            actions={[
                ...options.map((option) => ({
                    id: option,
                    // SAFETY: the ternary produces one of the two literals; the assertion is
                    // what keeps the menu item's state field a union rather than one of them.
                    state: (option === code ? "on" : "off") as "on" | "off",
                    title: option,
                })),
                {
                    id: MANAGE_CURRENCIES_ACTION,
                    title: t("log.insights.currencyManage"),
                },
            ]}
            onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === MANAGE_CURRENCIES_ACTION) {
                    onManage();
                    return;
                }
                onSelect(nativeEvent.event);
            }}
            shouldOpenOnLongPress={false}
            title={t("log.insights.currency")}
        >
            <View
                accessibilityLabel={t("log.insights.currencyShown")}
                accessibilityRole="button"
                accessibilityValue={{ text: code }}
                className="bg-surface-secondary flex-row items-center gap-1 rounded-full px-2.25 py-1"
            >
                <MonoLabel className="text-foreground">{code}</MonoLabel>
                <HugeiconsIcon color="#767676" icon={ArrowDown01Icon} size={10} />
            </View>
        </MenuView>
    );
}
