import { Button, HStack, Image, Rectangle, Spacer, Text as SwiftText, VStack, ZStack } from "@expo/ui/swift-ui";
import {
    accessibilityLabel,
    background,
    buttonStyle,
    contentShape,
    font,
    foregroundStyle,
    frame,
    padding,
    shapes,
} from "@expo/ui/swift-ui/modifiers";

const TILE = 38;
const NODE = 22;
const STEM_WEIGHT = 1.5;
const ROW_H = 36;
const STUB = 9;
const CAPSULE = shapes.capsule();

const KICKER = font({ design: "monospaced", size: 10, weight: "regular" });
const NAME = font({ design: "rounded", size: 16, weight: "semibold" });
const FIGURE = font({ design: "monospaced", size: 12 });
const PILL = font({ design: "monospaced", size: 12 });

export interface TransferGapPrompt {
    /** Null where a fee cannot explain the gap — a negative one would be a refund. */
    feeLabel: string | null;
    message: string;
    onFee: (() => void) | null;
    onRate: (() => void) | null;
    /** Null once accepting it would not move the gap — the rate already is this. */
    rateLabel: string | null;
}

export interface TransferLegView {
    balance: string;
    currency: string;
    emoji: string | null;
    kicker: string;
    name: string;
    onPress: () => void;
    tint: string;
}

interface TransferEditorSlipProps {
    addFeeLabel: string;
    cardColor: string;
    feeFill: string;
    feeSideLabel: string;
    feeValue: string | null;
    from: TransferLegView;
    gap: TransferGapPrompt | null;
    mutedColor: string;
    mutedFill: string;
    onFeePress: () => void;
    onFeeSideToggle: () => void;
    onRatePress: () => void;
    onSwap: () => void;
    rateValue: string | null;
    showRate: boolean;
    stemColor: string;
    surfaceColor: string;
    swapA11y: string;
    tintColor: string;
    to: TransferLegView;
    transferColor: string;
    warnColor: string;
}

/**
 * Drawn, not spaced — the same vocabulary the category tree's `TreeConnector`
 * uses. The height is explicit because a `ZStack` otherwise collapses to its
 * node and the stem never reaches the rows it is meant to join.
 */
function Gutter({
    children,
    height,
    transferColor,
}: {
    children?: React.ReactNode;
    height: number;
    transferColor: string;
}) {
    return (
        <ZStack modifiers={[frame({ height, width: TILE })]}>
            <Rectangle modifiers={[foregroundStyle(transferColor), frame({ height, width: STEM_WEIGHT })]} />
            {children}
        </ZStack>
    );
}

function Leg({
    leg,
    mutedColor,
    stem,
    stemColor,
    surfaceColor,
    tintColor,
}: {
    leg: TransferLegView;
    mutedColor: string;
    stem: "above" | "below";
    stemColor: string;
    surfaceColor: string;
    tintColor: string;
}) {
    const stub = <Rectangle modifiers={[foregroundStyle(stemColor), frame({ height: STUB, width: STEM_WEIGHT })]} />;
    return (
        <HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
            <VStack modifiers={[frame({ width: TILE })]} spacing={0}>
                {stem === "above" ? stub : null}
                <SwiftText
                    modifiers={[
                        font({ size: 18 }),
                        frame({ height: TILE, width: TILE }),
                        background(
                            surfaceColor,
                            shapes.roundedRectangle({ cornerRadius: 11, roundedCornerStyle: "continuous" })
                        ),
                    ]}
                >
                    {leg.emoji ?? "•"}
                </SwiftText>
                {stem === "below" ? stub : null}
            </VStack>
            <VStack alignment="leading" spacing={1}>
                <SwiftText modifiers={[KICKER, foregroundStyle(mutedColor)]}>{leg.kicker}</SwiftText>
                <HStack spacing={5}>
                    <SwiftText modifiers={[NAME, foregroundStyle(tintColor)]}>{leg.name}</SwiftText>
                    <Image color={mutedColor} size={11} systemName="chevron.up.chevron.down" />
                </HStack>
            </VStack>
            <Spacer />
            <VStack alignment="trailing" spacing={1}>
                <SwiftText modifiers={[FIGURE, foregroundStyle(mutedColor)]}>{leg.balance}</SwiftText>
                <SwiftText modifiers={[KICKER, foregroundStyle(mutedColor)]}>{leg.currency}</SwiftText>
            </VStack>
        </HStack>
    );
}

export function TransferEditorSlip({
    from,
    to,
    showRate,
    rateValue,
    feeValue,
    feeSideLabel,
    addFeeLabel,
    gap,
    tintColor,
    mutedColor,
    transferColor,
    warnColor,
    surfaceColor,
    stemColor,
    cardColor,
    feeFill,
    mutedFill,
    swapA11y,
    onSwap,
    onRatePress,
    onFeePress,
    onFeeSideToggle,
}: TransferEditorSlipProps) {
    const pill = (color: string) => [
        PILL,
        foregroundStyle(color),
        padding({ horizontal: 10, vertical: 4 }),
        background(surfaceColor, CAPSULE),
    ];

    return (
        <VStack alignment="leading" spacing={0}>
            <Button modifiers={[buttonStyle("plain")]} onPress={from.onPress}>
                <Leg
                    leg={from}
                    mutedColor={mutedColor}
                    stem="below"
                    stemColor={stemColor}
                    surfaceColor={surfaceColor}
                    tintColor={tintColor}
                />
            </Button>

            <HStack modifiers={[frame({ height: ROW_H })]} spacing={12}>
                <Gutter height={ROW_H} transferColor={stemColor}>
                    <Button modifiers={[buttonStyle("plain"), accessibilityLabel(swapA11y)]} onPress={onSwap}>
                        <Image
                            color="#ffffff"
                            modifiers={[
                                frame({ height: NODE, width: NODE }),
                                background(transferColor, CAPSULE),
                                contentShape(shapes.rectangle()),
                            ]}
                            size={11}
                            systemName="arrow.up.arrow.down"
                        />
                    </Button>
                </Gutter>
                {showRate && rateValue ? (
                    <Button modifiers={[buttonStyle("plain")]} onPress={onRatePress}>
                        <SwiftText modifiers={pill(transferColor)}>{rateValue}</SwiftText>
                    </Button>
                ) : null}
                <Spacer />
            </HStack>

            <HStack modifiers={[frame({ height: ROW_H })]} spacing={12}>
                <Gutter height={ROW_H} transferColor={stemColor}>
                    <SwiftText
                        modifiers={[
                            font({ size: 13, weight: "semibold" }),
                            foregroundStyle(feeValue ? tintColor : mutedColor),
                            frame({ height: NODE, width: NODE }),
                            background(feeValue ? feeFill : mutedFill, CAPSULE),
                            background(cardColor, CAPSULE),
                        ]}
                    >
                        {feeValue ? "−" : "+"}
                    </SwiftText>
                </Gutter>
                <Button modifiers={[buttonStyle("plain")]} onPress={onFeePress}>
                    <SwiftText modifiers={pill(feeValue ? tintColor : mutedColor)}>{feeValue ?? addFeeLabel}</SwiftText>
                </Button>
                {feeValue ? (
                    <Button modifiers={[buttonStyle("plain")]} onPress={onFeeSideToggle}>
                        <SwiftText modifiers={[KICKER, foregroundStyle(mutedColor)]}>{feeSideLabel}</SwiftText>
                    </Button>
                ) : null}
                <Spacer />
            </HStack>

            {gap ? (
                <VStack alignment="leading" spacing={6}>
                    <HStack modifiers={[frame({ height: ROW_H })]} spacing={12}>
                        <Gutter height={ROW_H} transferColor={stemColor}>
                            <SwiftText
                                modifiers={[
                                    font({ size: 13, weight: "bold" }),
                                    foregroundStyle("#ffffff"),
                                    frame({ height: NODE, width: NODE }),
                                    background(warnColor, CAPSULE),
                                ]}
                            >
                                !
                            </SwiftText>
                        </Gutter>
                        <SwiftText modifiers={[PILL, foregroundStyle(warnColor)]}>{gap.message}</SwiftText>
                        <Spacer />
                    </HStack>
                    <HStack spacing={6}>
                        <Gutter height={ROW_H} transferColor={stemColor} />
                        {gap.feeLabel && gap.onFee ? (
                            <Button modifiers={[buttonStyle("plain")]} onPress={gap.onFee}>
                                <SwiftText modifiers={pill(transferColor)}>{gap.feeLabel}</SwiftText>
                            </Button>
                        ) : null}
                        {gap.rateLabel && gap.onRate ? (
                            <Button modifiers={[buttonStyle("plain")]} onPress={gap.onRate}>
                                <SwiftText modifiers={pill(mutedColor)}>{gap.rateLabel}</SwiftText>
                            </Button>
                        ) : null}
                        <Spacer />
                    </HStack>
                </VStack>
            ) : null}

            <Button modifiers={[buttonStyle("plain")]} onPress={to.onPress}>
                <Leg
                    leg={to}
                    mutedColor={mutedColor}
                    stem="above"
                    stemColor={stemColor}
                    surfaceColor={surfaceColor}
                    tintColor={tintColor}
                />
            </Button>
        </VStack>
    );
}
