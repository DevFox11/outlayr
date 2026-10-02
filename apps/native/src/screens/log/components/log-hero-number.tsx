import { use, useState } from "react";
import { View } from "react-native";

import { AmountsHiddenContext, fittedHeroSize, FlowAmount } from "@/components/amount-text";
import { Text } from "@/components/text";
import { amountDigits, amountParts, withCurrencySymbol } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";

/**
 * Scaled by hand rather than by a text style: the figure has to stay
 * proportionate to the body-sized ledger underneath it.
 */
const FONT_SIZE = 40;

interface LogHeroNumberProps {
    /** The currency the figure is denominated in — not always the global one. */
    code: string;
    /** Unsigned magnitude; the sign is passed separately. */
    magnitude: number;
    positive: boolean;
    showCents: boolean;
}

export function LogHeroNumber({ magnitude, code, positive, showCents }: LogHeroNumberProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const hidden = use(AmountsHiddenContext);
    const [width, setWidth] = useState(0);
    const parts = amountParts(magnitude, code, showCents, language);
    const digits = amountDigits(parts);
    const sign = positive ? "+" : "-";
    // Sized down as the symbol lengthens: a one-character "$" can sit close to the
    // figure, but a four-character "Bs.D" at the same weight reads as part of it.
    const symbolSize = FONT_SIZE * (parts.symbol.length > 1 ? 0.44 : 0.6);

    return (
        <View
            accessibilityLabel={hidden ? t("log.amounts.hidden") : `${sign}${withCurrencySymbol(parts, digits)}`}
            // Symbol and digits are one figure, not two things to swipe between.
            accessible
            className="flex-row items-baseline gap-1"
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
            <Text className="text-muted font-sans" numberOfLines={1} style={{ fontSize: symbolSize }}>
                {sign}
                {parts.symbol}
            </Text>
            <FlowAmount
                amount={magnitude}
                className="text-foreground font-sans tabular-nums"
                code={code}
                showCents={showCents}
                size={hidden ? FONT_SIZE : fittedHeroSize(FONT_SIZE, magnitude, parts.minorUnits, width)}
            />
        </View>
    );
}
