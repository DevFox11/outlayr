import { Pressable, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import type { SavingsGoalWithProgress } from "@/data/savings-goals";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

interface SavingsGoalsSectionProps {
    currency: string;
    goals: readonly SavingsGoalWithProgress[];
    onAdd: () => void;
    onPress: (id: string) => void;
    showCents: boolean;
}

/**
 * Goals on the Budgets tab, under the budgets themselves.
 *
 * A budget is a ceiling for this month and a goal is a floor for some later
 * month; they are the two things on the tab that state a number the ledger is
 * measured against, so they belong together rather than on a screen of their
 * own that would hold one list.
 */
export function SavingsGoalsSection({ goals, currency, showCents, onPress, onAdd }: SavingsGoalsSectionProps) {
    const t = useTranslation();
    const { language } = useLanguage();

    return (
        <View className="gap-2 px-5 pt-8">
            <MonoLabel>{t("goals.heading")}</MonoLabel>
            {goals.map(({ goal, progress, saved, target }) => {
                const pace = progress.pace
                    ? t("goals.pace", {
                          amount: formatAmount(progress.pace.perMonth, currency, showCents, language),
                      })
                    : t("goals.remaining", {
                          amount: formatAmount(progress.remaining, currency, showCents, language),
                      });
                return (
                    <Pressable
                        accessibilityHint={t("goals.a11y.openHint")}
                        accessibilityLabel={t("goals.a11y.row", {
                            name: goal.name,
                            percent: String(Math.round(progress.fraction * 100)),
                            saved: formatAmount(saved, currency, showCents, language),
                            target: formatAmount(target, currency, showCents, language),
                        })}
                        accessibilityRole="button"
                        className="border-border gap-1.5 border-t py-3 active:opacity-70"
                        key={goal.id}
                        onPress={() => onPress(goal.id)}
                    >
                        <View className="flex-row items-baseline justify-between gap-3">
                            <Text className="text-body text-foreground flex-1" numberOfLines={1}>
                                {goal.name}
                            </Text>
                            <Text className="text-body text-foreground font-mono tabular-nums" style={TABULAR}>
                                {formatAmount(saved, currency, showCents, language)}
                            </Text>
                            <Text className="text-label text-muted font-mono tabular-nums" style={TABULAR}>
                                {`/ ${formatAmount(target, currency, showCents, language)}`}
                            </Text>
                        </View>

                        <View className="bg-surface h-1.5 overflow-hidden rounded-sm">
                            <View
                                className={progress.reached ? "bg-income h-full" : "bg-foreground h-full"}
                                style={{
                                    width: `${Math.max(progress.fraction * 100, progress.fraction > 0 ? 2 : 0)}%`,
                                }}
                            />
                        </View>

                        <Text className="text-footnote text-muted">{progress.reached ? t("goals.reached") : pace}</Text>
                    </Pressable>
                );
            })}

            <Pressable
                accessibilityRole="button"
                className="border-border border-t py-3 active:opacity-70"
                onPress={onAdd}
            >
                <Text className="text-accent text-body">{t("goals.add")}</Text>
            </Pressable>
        </View>
    );
}
