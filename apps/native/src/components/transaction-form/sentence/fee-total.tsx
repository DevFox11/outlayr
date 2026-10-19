import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

import { HeroNumber } from "../../amount-text";
import { Sentence } from "../../sentence/sentence";
import { SentenceValue } from "../../sentence/sentence-value";
import { Text } from "../../text";

const FIGURE_SIZE = 34;
const TILE_DROP = 3;
const MATH_TEXT = "text-subtitle text-muted tabular-nums";
const MATH_RULE_BOTTOM = 1;

interface FeeTotalProps {
    account: string | null;
    accountTile?: ReactNode;
    base: number;
    code: string;
    fee: number;
    onPress: () => void;
}

export function FeeTotal({ account, accountTile, base, code, fee, onPress }: FeeTotalProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const total = base + fee;
    const label = account === null ? t("transaction.fee.total") : t("transaction.fee.pays", { account });
    const baseText = formatAmount(base, code, true, language);
    const feeText = t("transaction.fee.part", { fee: formatAmount(fee, code, true, language) });

    return (
        <Pressable
            accessibilityLabel={`${label} ${formatAmount(total, code, true, language)}`}
            accessibilityRole="button"
            accessibilityValue={{ text: t("transaction.fee.line", { base: baseText, fee: feeText }) }}
            className="border-separator border-t pt-3"
            onPress={onPress}
        >
            <View className="flex-row flex-wrap items-baseline gap-x-3">
                <View className="max-w-full shrink flex-row items-baseline gap-2">
                    {accountTile === undefined ? null : (
                        <View style={{ transform: [{ translateY: TILE_DROP }] }}>{accountTile}</View>
                    )}
                    <Text className="text-callout text-foreground font-sans-medium shrink" numberOfLines={1}>
                        {label}
                    </Text>
                </View>
                <View className="ml-auto">
                    <HeroNumber amount={total} code={code} sign="" size={FIGURE_SIZE} still />
                </View>
            </View>
            <Sentence
                gapClassName="gap-x-1"
                slots={{
                    base: <Text className={MATH_TEXT}>{baseText}</Text>,
                    fee: (
                        <SentenceValue
                            accessibilityLabel={feeText}
                            onPress={onPress}
                            ruleBottom={MATH_RULE_BOTTOM}
                            swapKey="fee"
                            value={feeText}
                        />
                    ),
                }}
                template={t("transaction.fee.line")}
                textClassName={MATH_TEXT}
            />
        </Pressable>
    );
}
