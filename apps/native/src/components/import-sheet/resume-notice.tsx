import { Pressable, View } from "react-native";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";

interface ResumeNoticeProps {
	onStartOver: () => void;
}

export function ResumeNotice({ onStartOver }: ResumeNoticeProps) {
	const t = useTranslation();

	return (
		<View
			className="flex-row items-center gap-1.5 pb-3"
			testID="import-resume-notice"
		>
			<Text className="flex-1 text-footnote text-muted">
				{t("import.resumeNotice")}
			</Text>
			<Pressable
				accessibilityRole="button"
				hitSlop={8}
				onPress={onStartOver}
				testID="import-resume-start-over"
			>
				<Text className="font-sans-medium text-footnote text-foreground underline">
					{t("import.startOver")}
				</Text>
			</Pressable>
		</View>
	);
}
