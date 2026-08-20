import { Pressable } from "react-native";

import { Text } from "../../text";

interface CurrencyCodeProps {
    accessibilityLabel: string;
    code: string;
    onPress: () => void;
}

/**
 * The entry's currency, riding the amount's baseline.
 *
 * It was a chip in a bar above the sentence, where it was both the smallest
 * target on the screen and the furthest thing from the number it qualifies.
 * Set in the sentence it reads as part of the amount, which is what it is — and
 * with the grey pill gone it is three mono letters against the number rather
 * than a second shape competing with it.
 */
export function CurrencyCode({ accessibilityLabel, code, onPress }: CurrencyCodeProps) {
    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityValue={{ text: code }}
            // Three glyphs at 13/18 is a ~30x18 box. 14 on each edge is what
            // takes it past 44 in both axes now that no padding does.
            hitSlop={14}
            onPress={onPress}
        >
            <Text className="text-tint text-footnote font-mono">{code}</Text>
        </Pressable>
    );
}
