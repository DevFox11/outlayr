import { Button, HStack, Image, RNHostView, Spacer, Text as SwiftText, VStack } from "@expo/ui/swift-ui";
import {
    accessibilityLabel,
    background,
    buttonStyle,
    font,
    foregroundStyle,
    padding,
} from "@expo/ui/swift-ui/modifiers";
import type { EntryRateType } from "@outlayr/money/rates";
import { NumberFlow } from "number-flow-react-native";
import { Text, View } from "react-native";

import { amountHeroFontSize } from "@/domain/amount-hero-size";
import { numberLocale } from "@/domain/money";
import { useLanguage } from "@/i18n/context";
import { hitArea, outline } from "@/lib/swift-ui-geometry";

const CAPSULE = outline.capsule();
const CHIP = font({ design: "monospaced", size: 11, weight: "medium" });
const ARRIVES = font({ design: "monospaced", size: 13 });

interface RateOption {
    label: string;
    value: EntryRateType;
}

interface TransferEditorHeroProps {
    arrivedA11y: string;
    arrivedLabel: string | null;
    chipColor: string;
    contentWidth: number;
    minorUnits: number;
    mutedColor: string;
    onArrivedPress: () => void;
    onRateTypeChange: (type: EntryRateType) => void;
    onSentPress: () => void;
    rateOptions: RateOption[];
    rateType: EntryRateType;
    sent: number;
    symbol: string;
    tintColor: string;
    transferColor: string;
}

export function TransferEditorHero({
    sent,
    arrivedA11y,
    symbol,
    minorUnits,
    contentWidth,
    tintColor,
    mutedColor,
    transferColor,
    chipColor,
    arrivedLabel,
    rateOptions,
    rateType,
    onRateTypeChange,
    onSentPress,
    onArrivedPress,
}: TransferEditorHeroProps) {
    const { language } = useLanguage();
    const locale = numberLocale(language);
    const digitsSize = amountHeroFontSize(sent, minorUnits, contentWidth);
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
                  foregroundStyle(transferColor),
                  padding({ horizontal: 14, vertical: 7 }),
                  background(chipColor, CAPSULE),
              ]
            : [CHIP, foregroundStyle(mutedColor), padding({ horizontal: 14, vertical: 7 })];

    return (
        <VStack spacing={12}>
            {rateOptions.length > 1 ? (
                <HStack spacing={2}>
                    <Spacer />
                    {rateOptions.map((option) => (
                        <Button
                            key={option.value}
                            modifiers={[buttonStyle("plain")]}
                            onPress={() => onRateTypeChange(option.value)}
                        >
                            <SwiftText modifiers={chip(option.value === rateType)}>{option.label}</SwiftText>
                        </Button>
                    ))}
                    <Spacer />
                </HStack>
            ) : null}

            <Button modifiers={[buttonStyle("plain"), hitArea(outline.rectangle())]} onPress={onSentPress}>
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
                                color: tintColor,
                                fontFamily: "SFProRounded-Semibold",
                                fontSize: digitsSize,
                            }}
                            value={sent}
                        />
                        {locale.placement === "suffix" ? symbolNode : null}
                    </View>
                </RNHostView>
            </Button>

            {arrivedLabel ? (
                <HStack>
                    <Spacer />
                    <Button
                        modifiers={[
                            buttonStyle("plain"),
                            accessibilityLabel(arrivedA11y),
                            hitArea(outline.rectangle()),
                        ]}
                        onPress={onArrivedPress}
                    >
                        <HStack
                            modifiers={[padding({ horizontal: 12, vertical: 6 }), background(chipColor, CAPSULE)]}
                            spacing={6}
                        >
                            <SwiftText modifiers={[ARRIVES, foregroundStyle(transferColor)]}>{arrivedLabel}</SwiftText>
                            <Image color={transferColor} size={11} systemName="pencil" />
                        </HStack>
                    </Button>
                    <Spacer />
                </HStack>
            ) : null}
        </VStack>
    );
}
