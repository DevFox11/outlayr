import { RNHostView, VStack } from "@expo/ui/swift-ui";
import { onGeometryChange, padding } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { IdentityHero } from "../identity-hero";
import { HERO_BOTTOM_PADDING, HERO_TOP_PADDING } from "./style";

interface TransactionFormIdentitySectionProps {
    color: string | null;
    contentWidth: number;
    emoji: string | null;
    floatProgress: SharedValue<number>;
    heroWinY: SharedValue<number>;
    icon: string | null;
    income: boolean;
    onPress: () => void;
    onReset: () => void;
    photoUri: string | null;
}

/**
 * `IdentityHero` imports `react-native-reanimated`, which crashes jest at
 * module-load time (see `src/domain/curtain-hues.ts`) — the same reason the
 * whole form can't render there. This component inherits that gap rather
 * than introducing it, so it has no automated coverage.
 */
export function TransactionFormIdentitySection({
    contentWidth,
    color,
    emoji,
    icon,
    photoUri,
    income,
    floatProgress,
    heroWinY,
    onPress,
    onReset,
}: TransactionFormIdentitySectionProps) {
    return (
        <VStack
            modifiers={[
                // FIRST in the array on purpose: modifiers reduce in order
                // (`View+ModifierArray.swift`), so this reads the UNPADDED
                // stack — the hero ring's own top — and the paddings below
                // then wrap it. Move it after them and the twin rests
                // HERO_TOP_PADDING too high, ghosting through the crossfade.
                onGeometryChange((frame) => {
                    heroWinY.set(frame.y);
                }),
                padding({ top: HERO_TOP_PADDING }),
                padding({ bottom: HERO_BOTTOM_PADDING }),
            ]}
        >
            <RNHostView matchContents>
                {/* An unconstrained RN view stretches to the whole Host, so
				    `matchContents` reports the FULL screen width back to
				    SwiftUI — the VStack then overflows its own horizontal
				    padding and drags every sibling card out to the screen
				    edge with it. */}
                <View style={{ alignItems: "center", width: contentWidth }}>
                    <IdentityHero
                        color={color}
                        emoji={emoji}
                        floatProgress={floatProgress}
                        icon={icon}
                        income={income}
                        onPress={onPress}
                        onReset={onReset}
                        photoUri={photoUri}
                        variant="transaction"
                    />
                </View>
            </RNHostView>
        </VStack>
    );
}
