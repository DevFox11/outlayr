import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Text } from "../text";
import { cn } from "../tw";
import { useSentenceStyle } from "./sentence";
import { SentenceWash } from "./sentence-wash";
import { useSentenceShake } from "./use-sentence-shake";

/** Matches {@link import("./sentence-value").SentenceValue}'s rule. */
const RULE_BOTTOM = 7;

interface SentenceBlankProps {
    accessibilityLabel: string;
    /** Marks this as the slot the stage below the sentence is editing. */
    active?: boolean;
    /** Marks the one blank that is holding the save back. */
    flagged?: boolean;
    label: string;
    onPress: () => void;
    optional?: boolean;
    optionalHint?: string;
    /** Rises on each rejected save, so a second attempt is answered again. */
    shake?: boolean;
}

/**
 * An unfilled slot. It states what belongs there rather than asking for it, so
 * the sentence still reads as a sentence with nothing entered — which is what
 * lets the screen carry no instructional copy at all.
 *
 * Deliberately still until flagged: a blank that pulsed would be the one thing
 * on the screen repainting every frame, and there may be four of them.
 */
export function SentenceBlank({
    accessibilityLabel,
    active,
    flagged,
    label,
    onPress,
    optional,
    optionalHint,
    shake,
}: SentenceBlankProps) {
    const { textClassName } = useSentenceStyle();
    const shakeStyle = useSentenceShake(shake);

    const tone = () => {
        if (flagged) {
            return "text-danger";
        }
        return optional && !active ? "text-grammar" : "text-foreground";
    };

    // Dashed only while the slot is genuinely empty: once it is the one being
    // filled, or the one refusing the save, a solid rule says so.
    const rule = () => {
        if (flagged) {
            return "bg-danger h-[2px] rounded-full";
        }
        if (active) {
            return "bg-tint h-[2px] rounded-full";
        }
        return optional ? "border-grammar border-b border-dotted" : "border-tint border-b-2 border-dashed";
    };

    return (
        <Animated.View style={shakeStyle}>
            <Pressable
                accessibilityHint={optional ? optionalHint : undefined}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityValue={{ text: label }}
                onPress={onPress}
            >
                <SentenceWash active={active} />
                <Text className={cn(textClassName, tone())}>{label}</Text>
                <View
                    className={cn("absolute right-0 left-0", rule())}
                    pointerEvents="none"
                    style={{ bottom: RULE_BOTTOM }}
                />
            </Pressable>
        </Animated.View>
    );
}
