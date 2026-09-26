import { Pressable, View } from "react-native";

import { useDisplaySettings } from "@/contexts/display-settings-context";
import { currencySymbol, formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

import { FlowAmount } from "./amount-text";
import { MonoLabel } from "./mono-label";
import { cn } from "./tw";

export interface LedgerCell {
    /** Overrides the spoken hint, which otherwise says the figure is promotable. */
    accessibilityHint?: string;
    /**
     * Whether the figure earns the income colour. Only money actually coming in
     * does; a positive net is still just a net.
     */
    income: boolean;
    /** One short word, so every cell fits across the narrowest phone. */
    label: string;
    /** Unsigned — the sign comes from `positive`, so 40 out and 40 in match. */
    magnitude: number;
    onPress: () => void;
    positive: boolean;
}

interface LedgerHeadProps {
    /** The measures the hero is *not* showing, in a stable declaration order. */
    cells: readonly LedgerCell[];
    code: string;
}

/**
 * The order of `cells` must not depend on which measure is promoted — the pair
 * reshuffling under your thumb is how you tap the wrong one.
 */
export function LedgerHead({ cells, code }: LedgerHeadProps) {
    const { showCents } = useDisplaySettings().state;
    const t = useTranslation();
    const { language } = useLanguage();
    return (
        <View>
            <View className="bg-border h-px w-full" />
            <View className="flex-row">
                {cells.map((cell, index) => (
                    <View className={cn("flex-1 overflow-hidden", index > 0 && "pl-3.5")} key={index}>
                        {/* Absolute so the rule spans the taller of the two columns
						    rather than only its own content. */}
                        {index > 0 ? <View className="bg-border absolute inset-y-0 left-0 w-px" /> : null}
                        <Pressable
                            accessibilityHint={cell.accessibilityHint ?? t("log.ledger.showFigure")}
                            accessibilityLabel={`${cell.label}, ${cell.positive ? "+" : "-"}${formatAmount(cell.magnitude, code, showCents, language)}`}
                            accessibilityRole="button"
                            className="gap-0.75 py-2.5 active:opacity-70"
                            onPress={cell.onPress}
                        >
                            <MonoLabel>{cell.label}</MonoLabel>
                            <FlowAmount
                                amount={cell.magnitude}
                                className={cn(
                                    "font-sans-semibold text-body tabular-nums",
                                    cell.income ? "text-income" : "text-foreground"
                                )}
                                code={code}
                                prefix={`${cell.positive ? "+" : "-"}${currencySymbol(code)}`}
                                showCents={showCents}
                            />
                        </Pressable>
                    </View>
                ))}
            </View>
        </View>
    );
}
