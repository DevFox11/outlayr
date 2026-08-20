import { Pressable, View } from "react-native";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import type { UnbudgetedScope } from "@/data/budgets";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

/**
 * How many unbudgeted scopes the tab offers at once.
 *
 * The rail is a suggestion, not a chore list: every row on it is work the reader
 * did not ask for, and a list of fourteen reads as one. The rest are reachable
 * through the picker in the toolbar.
 */
const RAIL_LIMIT = 2;

interface UnbudgetedRailProps {
    currency: string;
    /**
     * What the whole ledger typically costs, or null when no closed window holds
     * enough to say. Only the caption: whether the row appears at all is
     * {@link UnbudgetedRailProps.offerEverything}, because a ledger too young to
     * have a typical figure is exactly the one that still needs the budget.
     */
    everythingTypical: number | null;
    /**
     * Offer the whole ledger as a scope. True while no overall budget exists —
     * once one does, the tab's head is that budget and a row offering to set it
     * again would be a second door to one thing.
     */
    offerEverything: boolean;
    onPress: (scope: UnbudgetedScope | null) => void;
    /** The cadence the typical figure is stated in, e.g. "a month". */
    periodPhrase: string;
    scopes: readonly UnbudgetedScope[];
}

/** What you spend on and have not budgeted, heaviest first. */
export function UnbudgetedRail({
    scopes,
    currency,
    everythingTypical,
    offerEverything,
    periodPhrase,
    onPress,
}: UnbudgetedRailProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const shown = scopes.slice(0, RAIL_LIMIT);

    if (shown.length === 0 && !offerEverything) {
        return null;
    }

    const typicalLine = (amount: number) =>
        t("budgets.rail.typical", {
            amount: formatAmount(amount, currency, false, language),
            period: periodPhrase,
        });

    return (
        <View className="pt-7">
            <MonoLabel>{t("budgets.rail.title")}</MonoLabel>
            <View className="border-border mt-2 border-t">
                {offerEverything ? (
                    <Pressable
                        accessibilityRole="button"
                        className="border-border flex-row items-center gap-3 border-b py-3 active:opacity-60"
                        onPress={() => onPress(null)}
                    >
                        {/* The one scope with no category to draw: the ledger itself. */}
                        <CategoryIconTile color="#767676" emoji={null} icon={null} size={30} />
                        <View className="flex-1 gap-0.5">
                            <Text className="text-body text-foreground">{t("budgets.scope.everything")}</Text>
                            {everythingTypical === null ? null : (
                                <Text className="text-muted text-subtitle" style={{ fontVariant: ["tabular-nums"] }}>
                                    {typicalLine(everythingTypical)}
                                </Text>
                            )}
                        </View>
                        <Text className="text-tint text-subtitle">{t("budgets.rail.set")}</Text>
                    </Pressable>
                ) : null}
                {shown.map((scope) => (
                    <Pressable
                        accessibilityRole="button"
                        className="border-border flex-row items-center gap-3 border-b py-3 active:opacity-60"
                        key={scope.categoryId}
                        onPress={() => onPress(scope)}
                    >
                        <CategoryIconTile color={scope.color} emoji={scope.emoji} icon={scope.icon} size={30} />
                        <View className="flex-1 gap-0.5">
                            <Text className="text-body text-foreground">{scope.name}</Text>
                            <Text className="text-muted text-subtitle" style={{ fontVariant: ["tabular-nums"] }}>
                                {typicalLine(scope.typical)}
                            </Text>
                        </View>
                        <Text className="text-tint text-subtitle">{t("budgets.rail.set")}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
