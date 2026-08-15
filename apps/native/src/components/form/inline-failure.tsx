import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Text } from "@/components/text";
import { useColors } from "@/theme/use-colors";

/**
 * A save or validation failure raised from a screen that stays up afterwards —
 * a `formSheet` or `modal`.
 *
 * These cannot be toasts: `PanelUIProvider` mounts the toast viewport at the app
 * root and a native presentation covers it, so the notice would be silent — see
 * the note in `@/lib/notify`. It reads where the retry happens instead: against
 * the button that failed, or under the field that is wrong.
 *
 * Nothing moves focus, so VoiceOver would never reach a line that appeared
 * behind the cursor — hence the announcement.
 */
export function InlineFailure({ message }: { message: string | null }) {
    const colors = useColors();

    useEffect(() => {
        if (message !== null) {
            AccessibilityInfo.announceForAccessibility(message);
        }
    }, [message]);

    if (message === null) {
        return null;
    }

    return (
        <Animated.View
            accessibilityRole="alert"
            className="flex-row items-center gap-1.5 px-1 pb-2"
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(120)}
        >
            <SymbolView name="exclamationmark.circle.fill" size={13} tintColor={colors.danger} type="monochrome" />
            <Text className="text-danger text-footnote flex-1 leading-snug">{message}</Text>
        </Animated.View>
    );
}
