import { RingChart } from "panelui-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { Text } from "@/components/text";
import { useDisplaySettings, useSettingBool } from "@/contexts/display-settings-context";
import type { CategoryBudgetView } from "@/data/budgets";
import { budgetRingData } from "@/domain/budget-rings";
import type { BudgetRingDatum } from "@/domain/budget-rings";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { CHART_DRAW } from "@/theme/chart";

const RING_CHART_SIZE = 184;

interface BudgetRingsProps {
    budgets: readonly CategoryBudgetView[];
    currency: string;
}

interface BudgetRingLegendRowProps {
    currency: string;
    language: "en" | "es";
    onPress: () => void;
    ring: BudgetRingDatum;
    selected: boolean;
    showCents: boolean;
}

function BudgetRingLegendRow({ currency, language, onPress, ring, selected, showCents }: BudgetRingLegendRowProps) {
    const t = useTranslation();
    const spent = formatAmount(ring.value, currency, showCents, language);
    const limit = formatAmount(ring.maxValue, currency, showCents, language);
    const over = formatAmount(ring.overAmount, currency, showCents, language);
    const detail = ring.overBudget
        ? t("budgets.rings.over", { amount: over })
        : t("budgets.spentOfLimit", { limit, spent });
    const accessibilityLabel = t(
        ring.overBudget ? "budgets.rings.rowA11yOver" : "budgets.rings.rowA11y",
        ring.overBudget
            ? { amount: over, name: ring.label, percent: ring.percent }
            : { limit, name: ring.label, percent: ring.percent, spent }
    );

    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${selected ? "bg-surface-secondary" : "bg-surface"}`}
            hitSlop={4}
            onPress={onPress}
        >
            <View className="size-3 rounded-full" style={{ backgroundColor: ring.color }} />
            <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-foreground text-subtitle" numberOfLines={1}>
                    {ring.label}
                </Text>
                <Text className="text-footnote text-muted" numberOfLines={1}>
                    {detail}
                </Text>
            </View>
            <Text className="font-mono-medium text-foreground text-subtitle">{ring.percent}%</Text>
        </Pressable>
    );
}

export function BudgetRings({ budgets, currency }: BudgetRingsProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const reduceMotion = useReducedMotion();
    const animated = useSettingBool("animatedCharts") && !reduceMotion;
    const data = useMemo(() => budgetRingData(budgets), [budgets]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const activeIndex = selectedId === null ? -1 : data.findIndex((ring) => ring.id === selectedId);

    useEffect(() => {
        if (selectedId !== null && activeIndex === -1) {
            setSelectedId(null);
        }
    }, [activeIndex, selectedId]);

    if (data.length === 0) {
        return null;
    }

    const centerRing = data[Math.max(activeIndex, 0)] ?? null;
    const selectIndex = (index: number) => {
        setSelectedId(index >= 0 ? (data[index]?.id ?? null) : null);
    };

    return (
        <View className="gap-3 pt-6" testID="budget-rings-summary">
            <View>
                <Text className="font-sans-semibold text-foreground text-subtitle">{t("budgets.rings.heading")}</Text>
                <Text className="text-footnote text-muted">{t("budgets.rings.summary")}</Text>
            </View>

            <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID="budget-rings-panel-chart"
            >
                <RingChart
                    activeIndex={activeIndex}
                    animationDuration={animated ? CHART_DRAW.durationMs : 0}
                    data={data}
                    onActiveIndexChange={selectIndex}
                    ringGap={5}
                    size={RING_CHART_SIZE}
                    strokeWidth={11}
                >
                    {data.map((ring, index) => (
                        <RingChart.Ring index={index} key={ring.id} />
                    ))}
                    <RingChart.Center>
                        {() =>
                            centerRing ? (
                                <View className="items-center" testID="budget-rings-center">
                                    <Text className="text-caption text-muted" numberOfLines={1}>
                                        {centerRing.label}
                                    </Text>
                                    <Text
                                        className="font-sans-semibold text-foreground text-subtitle"
                                        numberOfLines={1}
                                    >
                                        {formatAmount(centerRing.value, currency, showCents, language)}
                                    </Text>
                                </View>
                            ) : null
                        }
                    </RingChart.Center>
                </RingChart>
            </View>

            <View className="divide-border border-border divide-y overflow-hidden rounded-2xl border">
                {data.map((ring) => (
                    <BudgetRingLegendRow
                        currency={currency}
                        key={ring.id}
                        language={language}
                        onPress={() => setSelectedId(selectedId === ring.id ? null : ring.id)}
                        ring={ring}
                        selected={selectedId === ring.id}
                        showCents={showCents}
                    />
                ))}
            </View>
        </View>
    );
}
