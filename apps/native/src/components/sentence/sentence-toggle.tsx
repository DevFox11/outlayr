import ArrowDataTransferVerticalIcon from "@hugeicons-pro/core-stroke-rounded/ArrowDataTransferVerticalIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { useColors } from "@/theme/use-colors";

import { Text } from "../text";
import { cn } from "../tw";
import { useSentenceStyle } from "./sentence";

/** Matches {@link import("./sentence-value").SentenceValue}'s rule. */
const RULE_BOTTOM = 7;

const SWAP_GLYPH = 13;

interface SentenceToggleProps {
    accessibilityLabel: string;
    onPress: () => void;
    value: string;
}

/**
 * A word in the sentence that flips between a fixed set rather than opening a
 * picker.
 *
 * Its rule is solid, like a value's: a toggle always has a value, and the dashed
 * rule it used to carry is the sentence's mark for a slot with nothing in it —
 * so it was claiming the verb was empty. The trailing glyph carries the "tap to
 * change this" the dash was there for, without saying "tap to choose one".
 */
export function SentenceToggle({ accessibilityLabel, onPress, value }: SentenceToggleProps) {
    const { textClassName } = useSentenceStyle();
    const colors = useColors();

    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityValue={{ text: value }}
            onPress={onPress}
        >
            <View className="flex-row items-baseline gap-1.5">
                <Text className={cn(textClassName, "text-foreground")}>{value}</Text>
                <HugeiconsIcon color={colors.tint} icon={ArrowDataTransferVerticalIcon} size={SWAP_GLYPH} />
            </View>
            <View
                className="bg-tint absolute right-0 left-0 h-[2px] rounded-full"
                pointerEvents="none"
                style={{ bottom: RULE_BOTTOM }}
            />
        </Pressable>
    );
}
