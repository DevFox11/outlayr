import ArrowLeft01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowLeft01Icon";
import Cancel01Icon from "@hugeicons-pro/core-stroke-rounded/Cancel01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Button } from "panelui-native/components/button";
import { View } from "react-native";
import Animated, { FadeInLeft, FadeInRight, Keyframe, ReduceMotion } from "react-native-reanimated";

import { Text } from "@/components/text";
import { useTranslation } from "@/i18n/context";

const TRANSITION_MS = 200;

export const HEADER_BUTTON_ENTERING = new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.6 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
})
    .duration(TRANSITION_MS)
    .reduceMotion(ReduceMotion.System);

export function titleEntering(forward: boolean) {
    return (forward ? FadeInRight : FadeInLeft).duration(TRANSITION_MS).reduceMotion(ReduceMotion.System);
}

interface SheetHeaderProps {
    forward?: boolean;
    onBack?: () => void;
    onClose: () => void;
    title: string;
}

export function SheetHeader({ title, forward = true, onBack, onClose }: SheetHeaderProps) {
    const t = useTranslation();

    return (
        <View className="flex-row items-center px-5 py-2">
            <View
                className="absolute inset-0 items-center justify-center px-16"
                pointerEvents="none"
                testID="import-sheet-title"
            >
                <Animated.View entering={titleEntering(forward)} key={title} testID="import-sheet-title-motion">
                    <Text className="text-foreground text-headline font-medium" numberOfLines={1}>
                        {title}
                    </Text>
                </Animated.View>
            </View>

            {onBack ? (
                <Animated.View entering={HEADER_BUTTON_ENTERING} key={`back-${title}`}>
                    <Button
                        accessibilityLabel={t("common.back")}
                        className="rounded-full"
                        onPress={onBack}
                        size="icon"
                        testID="import-sheet-back"
                        variant="secondary"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
                    </Button>
                </Animated.View>
            ) : null}

            <Animated.View
                className="ml-auto"
                entering={HEADER_BUTTON_ENTERING}
                key={`close-${title}`}
                testID="import-sheet-close-slot"
            >
                <Button
                    accessibilityLabel={t("common.close")}
                    className="rounded-full"
                    onPress={onClose}
                    size="icon"
                    testID="import-sheet-close"
                    variant="secondary"
                >
                    <HugeiconsIcon icon={Cancel01Icon} size={22} />
                </Button>
            </Animated.View>
        </View>
    );
}
