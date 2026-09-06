import RotateClockwiseIcon from "@hugeicons-pro/core-stroke-rounded/RotateClockwiseIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

interface ResumeNoticeProps {
    onStartOver: () => void;
}

export function ResumeNotice({ onStartOver }: ResumeNoticeProps) {
    const t = useTranslation();
    const colors = useColors();

    return (
        <View className="border-border mx-5 flex-row items-center gap-3 border-y py-2.5" testID="import-resume-notice">
            <HugeiconsIcon color={colors.foreground} icon={RotateClockwiseIcon} size={18} strokeWidth={1.9} />
            <View className="flex-1 gap-0.5">
                <Text className="font-sans-medium text-footnote text-foreground" numberOfLines={1}>
                    {t("import.resumeNotice")}
                </Text>
                <Text className="text-muted text-subtitle" numberOfLines={1}>
                    {t("import.resumeBody")}
                </Text>
            </View>
            <Pressable
                accessibilityRole="button"
                className="active:opacity-60"
                hitSlop={8}
                onPress={onStartOver}
                testID="import-resume-start-over"
            >
                <Text className="font-sans-medium text-footnote text-muted underline">{t("import.startOver")}</Text>
            </Pressable>
        </View>
    );
}
