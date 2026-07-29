import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";

interface UndoToastProps {
	visible: boolean;
	onUndo: () => void;
}

export function UndoToast({ visible, onUndo }: UndoToastProps) {
	const t = useTranslation();
	if (!visible) {
		return null;
	}

	return (
		<Animated.View
			entering={FadeInDown.springify().damping(18)}
			exiting={FadeOutDown.duration(150)}
			pointerEvents="box-none"
			className="absolute right-5 bottom-safe-offset-24 left-5"
		>
			<View className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
				<Text className="text-foreground text-subtitle">
					{t("log.undo.deleted")}
				</Text>
				<Pressable
					onPress={onUndo}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel={t("log.undo.accessibility")}
				>
					<Text className="font-sans-semibold text-subtitle text-tint">
						{t("log.undo.action")}
					</Text>
				</Pressable>
			</View>
		</Animated.View>
	);
}
