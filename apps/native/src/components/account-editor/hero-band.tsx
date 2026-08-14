import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { HEADER_HEIGHT, HERO_BOTTOM_PADDING, HERO_TOP_PADDING } from "@/components/editor-style";
import { IdentityHero } from "@/components/identity-hero";

interface AccountEditorHeroBandProps {
    captionClearance: number;
    color: string;
    emoji: string | null;
    floatProgress: SharedValue<number>;
    icon: string | null;
    onLayout: (event: LayoutChangeEvent) => void;
    onPress: () => void;
    onReset: () => void;
    photoUri: string | null;
}

/**
 * `IdentityHero` imports `react-native-reanimated`, which crashes jest at
 * module-load time (see `src/domain/curtain-hues.ts`), so like the category
 * band this component's only coverage is on-device.
 */
export function AccountEditorHeroBand({
    captionClearance,
    color,
    emoji,
    floatProgress,
    icon,
    photoUri,
    onLayout,
    onPress,
    onReset,
}: AccountEditorHeroBandProps) {
    return (
        <View
            onLayout={onLayout}
            pointerEvents="box-none"
            style={{
                alignItems: "center",
                left: 0,
                paddingBottom: HERO_BOTTOM_PADDING + captionClearance,
                paddingTop: HEADER_HEIGHT + HERO_TOP_PADDING,
                position: "absolute",
                right: 0,
                top: 0,
            }}
        >
            <IdentityHero
                color={color}
                emoji={emoji}
                floatProgress={floatProgress}
                icon={icon}
                income={false}
                onPress={onPress}
                onReset={onReset}
                photoUri={photoUri}
                variant="transaction"
            />
        </View>
    );
}
