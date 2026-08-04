import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons-pro/core-stroke-rounded";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

export interface ImportSheetFooter {
	label: string;
	onPress: () => void;
	disabled: boolean;
}

interface ImportSheetChromeProps {
	title: string;
	canGoBack: boolean;
	onBack: () => void;
	onCancel: () => void;
	footer: ImportSheetFooter | null;
	children: ReactNode;
}

export function ImportSheetChrome({
	title,
	canGoBack,
	onBack,
	onCancel,
	footer,
	children,
}: ImportSheetChromeProps) {
	const t = useTranslation();
	const colors = useColors();

	return (
		<View className="flex-1">
			<View className="h-11 justify-center px-4">
				{canGoBack ? (
					<Pressable
						accessibilityRole="button"
						className="absolute top-0 bottom-0 left-4 justify-center active:opacity-60"
						hitSlop={8}
						onPress={onBack}
						testID="import-chrome-back"
					>
						<HugeiconsIcon
							color={colors.muted}
							icon={ArrowLeft01Icon}
							size={16}
							strokeWidth={2}
						/>
					</Pressable>
				) : null}
				<Text
					accessibilityRole="header"
					className="text-center font-sans-semibold text-callout text-foreground"
					pointerEvents="none"
					testID="import-chrome-title"
				>
					{title}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 right-4 bottom-0 justify-center active:opacity-60"
					hitSlop={8}
					onPress={onCancel}
				>
					<Text className="font-sans-semibold text-callout text-tint">
						{t("common.cancel")}
					</Text>
				</Pressable>
			</View>
			<View className="flex-1 px-5">{children}</View>
			{footer ? (
				<View className="border-border border-t px-5 pt-3 pb-safe-offset-3">
					<Pressable
						accessibilityRole="button"
						className="h-14 items-center justify-center rounded-[28px] bg-foreground active:opacity-70"
						disabled={footer.disabled}
						onPress={footer.onPress}
						style={footer.disabled ? { opacity: 0.4 } : undefined}
					>
						<Text className="font-sans-semibold text-background text-callout">
							{footer.label}
						</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}
