import { Button, HStack, Image, RNHostView, Spacer, Text as SwiftText, VStack } from "@expo/ui/swift-ui";
import { background, buttonStyle, font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { NumberFlow } from "number-flow-react-native";
import { Text, View } from "react-native";

import { amountHeroFontSize } from "@/domain/amount-hero-size";
import { numberLocale } from "@/domain/money";
import { useLanguage } from "@/i18n/context";
import { hitArea, outline } from "@/lib/swift-ui-geometry";

const CHIP = font({ design: "rounded", size: 15, weight: "semibold" });
const CURRENCY = font({ design: "rounded", size: 14, weight: "medium" });
const CAPSULE = outline.capsule();

interface TransactionFormAmountHeroProps {
    amount: number;
    amountColor: string;
    chipColor: string;
    contentWidth: number;
    currency: string;
    expenseLabel: string;
    income: boolean;
    incomeLabel: string;
    minorUnits: number;
    mutedColor: string;
    onCurrencyPress: () => void;
    onPress: () => void;
    onTypeChange: (next: "expense" | "income") => void;
    symbol: string;
}

export function TransactionFormAmountHero({
    symbol,
    amount,
    contentWidth,
    minorUnits,
    currency,
    amountColor,
    mutedColor,
    chipColor,
    income,
    expenseLabel,
    incomeLabel,
    onTypeChange,
    onPress,
    onCurrencyPress,
}: TransactionFormAmountHeroProps) {
    const { language } = useLanguage();
    const locale = numberLocale(language);
    const digitsSize = amountHeroFontSize(amount, minorUnits, contentWidth);
    const symbolSize = digitsSize * 0.48;
    // The symbol is styled apart from the digits, so it stays its own `Text`
    // rather than NumberFlow's prefix/suffix. That makes `locale.gap` — the NBSP
    // the string formatters glue it on with — a margin here instead.
    const symbolGap = locale.gap ? symbolSize * 0.28 : 0;
    const symbolNode = (
        <Text
            style={{
                color: mutedColor,
                fontFamily: "SFProRounded-Medium",
                fontSize: symbolSize,
                marginBottom: digitsSize * 0.16,
                marginLeft: locale.placement === "suffix" ? symbolGap : 0,
                marginRight: locale.placement === "prefix" ? symbolGap : 0,
            }}
        >
            {symbol}
        </Text>
    );

    const chip = (selected: boolean) =>
        selected
            ? [
                  CHIP,
                  foregroundStyle(amountColor),
                  padding({ horizontal: 18, vertical: 9 }),
                  background(chipColor, CAPSULE),
              ]
            : [CHIP, foregroundStyle(mutedColor), padding({ horizontal: 18, vertical: 9 })];

    return (
        <VStack spacing={14}>
            <HStack spacing={2}>
                <Spacer />
                <Button modifiers={[buttonStyle("plain")]} onPress={() => onTypeChange("expense")}>
                    <SwiftText modifiers={chip(!income)}>{expenseLabel}</SwiftText>
                </Button>
                <Button modifiers={[buttonStyle("plain")]} onPress={() => onTypeChange("income")}>
                    <SwiftText modifiers={chip(income)}>{incomeLabel}</SwiftText>
                </Button>
                <Spacer />
            </HStack>

            <Button modifiers={[buttonStyle("plain"), hitArea(outline.rectangle())]} onPress={onPress}>
                <RNHostView matchContents>
                    <View
                        style={{
                            alignItems: "flex-end",
                            flexDirection: "row",
                            height: digitsSize * 1.25,
                            justifyContent: "center",
                            width: contentWidth,
                        }}
                    >
                        {locale.placement === "prefix" ? symbolNode : null}
                        <NumberFlow
                            format={{
                                maximumFractionDigits: minorUnits,
                                minimumFractionDigits: minorUnits,
                                useGrouping: true,
                            }}
                            locales={locale.tag}
                            style={{
                                color: amountColor,
                                fontFamily: "SFProRounded-Semibold",
                                fontSize: digitsSize,
                            }}
                            value={amount}
                        />
                        {locale.placement === "suffix" ? symbolNode : null}
                    </View>
                </RNHostView>
            </Button>

            <HStack>
                <Spacer />
                <Button modifiers={[buttonStyle("plain")]} onPress={onCurrencyPress}>
                    <HStack
                        modifiers={[padding({ horizontal: 14, vertical: 7 }), background(chipColor, CAPSULE)]}
                        spacing={5}
                    >
                        <SwiftText modifiers={[CURRENCY, foregroundStyle(amountColor)]}>{currency}</SwiftText>
                        <Image color={mutedColor} size={11} systemName="chevron.up.chevron.down" />
                    </HStack>
                </Button>
                <Spacer />
            </HStack>
        </VStack>
    );
}
