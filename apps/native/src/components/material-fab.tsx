import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

/** M3's FAB, on the Log FAB's numbers: 56dp, 16dp corners, 16dp in from the edge. */
const SIZE = 56;
const MARGIN = 16;

/**
 * What a list scrolling under the FAB pads its end with, so its last row
 * clears the FAB. The FAB floats above the system bar, so the clearance grows
 * with the bottom inset: about 48dp more with 3-button navigation.
 */
export function useFabClearance(): number {
    return SIZE + MARGIN * 2 + useSafeAreaInsets().bottom;
}

/**
 * The Material 3 floating action button for a screen's one "new" action, in
 * the primary container. Android's answer to the bottom-toolbar add button the
 * iOS screens use.
 */
export function MaterialFab({ label, onPress }: { label: string; onPress: () => void }) {
    const m3 = useMaterialColors();
    const insets = useSafeAreaInsets();

    return (
        <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            android_ripple={{ borderless: false, color: withAlpha(m3.onPrimaryContainer, 0.12) }}
            className="bg-m3-primary-container absolute items-center justify-center overflow-hidden rounded-2xl"
            onPress={onPress}
            style={{
                bottom: insets.bottom + MARGIN,
                elevation: 6,
                height: SIZE,
                right: insets.right + MARGIN,
                width: SIZE,
            }}
        >
            <HugeiconsIcon color={m3.onPrimaryContainer} icon={PlusSignIcon} size={24} strokeWidth={1.8} />
        </Pressable>
    );
}
