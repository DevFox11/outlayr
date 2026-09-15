import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { HEADER_HEIGHT, HERO_BOTTOM_PADDING, HERO_TOP_PADDING } from "@/components/editor-style";
import { IdentityHero } from "@/components/identity-hero";

interface EditorHeroBandProps {
    captionClearance: number;
    color: string;
    emoji: string | null;
    floatProgress: SharedValue<number>;
    icon: string | null;
    income: boolean;
    onLayout: (event: LayoutChangeEvent) => void;
    onPress: () => void;
    onReset: () => void;
    photoUri: string | null;
    variant: "category" | "transaction";
}

export function EditorHeroBand({
    captionClearance,
    color,
    emoji,
    floatProgress,
    icon,
    income,
    photoUri,
    variant,
    onLayout,
    onPress,
    onReset,
}: EditorHeroBandProps) {
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
                income={income}
                onPress={onPress}
                onReset={onReset}
                photoUri={photoUri}
                variant={variant}
            />
        </View>
    );
}
