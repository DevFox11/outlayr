import ArrowRight01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowRight01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { useColors } from "@/theme/use-colors";

export function EditorRow({
    label,
    value,
    detail,
    onPress,
}: {
    detail?: ReactNode;
    label: string;
    onPress: () => void;
    value: string;
}) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityValue={{ text: value }}
            className="border-border border-b py-3.5 active:opacity-60"
            onPress={onPress}
        >
            <View className="flex-row items-center gap-3">
                <Text className="text-body text-foreground flex-1">{label}</Text>
                <Text className="text-body text-muted tabular-nums">{value}</Text>
                <HugeiconsIcon color={colors.subtle} icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
            </View>
            {detail ? <Text className="text-muted text-subtitle pt-1 leading-snug">{detail}</Text> : null}
        </Pressable>
    );
}
