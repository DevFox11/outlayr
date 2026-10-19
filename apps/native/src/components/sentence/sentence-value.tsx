import { useEffect } from "react";
import type { ReactNode } from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { currencySymbol, symbolPrefix } from "@/domain/money";
import { useColors } from "@/theme/use-colors";

import { FlowAmount } from "../amount-text";
import { Text } from "../text";
import { cn } from "../tw";
import { useSentenceStyle } from "./sentence";
import { SENTENCE_DRAW, valueEntering } from "./sentence-motion";
import { SentenceWash } from "./sentence-wash";
import { useSentenceShake } from "./use-sentence-shake";

/**
 * Clears the 26pt face's descenders without leaving the rule adrift in the
 * 38pt line box. Measured against SF Pro Rounded, not derived.
 */
const RULE_BOTTOM = 7;

export interface SentenceFigure {
    amount: number;
    code: string;
}

interface SentenceValueProps {
    accessibilityLabel: string;
    /** Marks this as the slot the stage below the sentence is editing. */
    active?: boolean;
    /** An inline tile drawn before the text, such as a merchant's logo. */
    children?: ReactNode;
    figure?: SentenceFigure;
    /**
     * Marks this fact as the one holding the save back. A value can be at fault
     * as readily as a blank: a category enrichment suggested is on screen and
     * still fails the save if it cannot be created.
     */
    flagged?: boolean;
    onPress: () => void;
    /** Dimmed while a suggestion for this slot is still resolving. */
    pending?: boolean;
    ruleBottom?: number;
    shake?: boolean;
    /**
     * Identity of the fact rather than of its text. The amount changes on every
     * keypad press and is still the same fact, so it passes a constant here and
     * updates in place instead of rewriting itself per digit.
     */
    swapKey?: string;
    value: string;
}

/**
 * A settled fact in the sentence: the word, and a rule that draws itself under
 * it. The rule is `scaleX` from a left origin rather than an animated width —
 * a width would relayout every word after it on each frame, and the sentence
 * lives inside `RNHostView`, which re-measures the whole SwiftUI form when it
 * does.
 */
export function SentenceValue({
    accessibilityLabel,
    active,
    children,
    figure,
    flagged,
    onPress,
    pending,
    ruleBottom = RULE_BOTTOM,
    shake,
    swapKey,
    value,
}: SentenceValueProps) {
    const { textClassName } = useSentenceStyle();
    const colors = useColors();
    const reduced = useReducedMotion();
    const draw = useSharedValue(reduced ? 1 : 0);
    const shakeStyle = useSentenceShake(shake);
    const identity = swapKey ?? value;

    useEffect(() => {
        if (reduced) {
            draw.set(1);
            return;
        }
        draw.set(0);
        draw.set(withTiming(1, SENTENCE_DRAW));
    }, [draw, identity, reduced]);

    const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: draw.get() }] }));

    const tone = () => {
        if (flagged) {
            return "text-danger";
        }
        if (active) {
            return "text-foreground";
        }
        return pending ? "text-muted" : "text-foreground";
    };

    return (
        <Animated.View style={shakeStyle}>
            <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ busy: pending }}
                accessibilityValue={{ text: value }}
                onPress={onPress}
            >
                <SentenceWash active={active} />
                <Animated.View className="flex-row items-baseline gap-1.5" entering={valueEntering()} key={identity}>
                    {children}
                    {figure ? (
                        <FlowAmount
                            amount={figure.amount}
                            className={cn(textClassName, tone())}
                            code={figure.code}
                            prefix={symbolPrefix(currencySymbol(figure.code))}
                            showCents
                            still
                        />
                    ) : (
                        <Text className={cn(textClassName, tone())}>{value}</Text>
                    )}
                </Animated.View>
                <Animated.View
                    className="absolute right-0 left-0 h-[2px] rounded-full"
                    pointerEvents="none"
                    style={[
                        {
                            backgroundColor: flagged ? colors.danger : colors.tint,
                            bottom: ruleBottom,
                            transformOrigin: "left",
                        },
                        ruleStyle,
                    ]}
                />
            </Pressable>
        </Animated.View>
    );
}
