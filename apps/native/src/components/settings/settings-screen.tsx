import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { Text } from "@/components/text";

export function SettingsScreen({
	children,
	footer,
}: {
	children: ReactNode;
	footer?: string;
}) {
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerClassName="px-5 pb-safe-offset-10"
			contentInsetAdjustmentBehavior="automatic"
		>
			{children}
			{footer ? (
				<Text className="pt-8 text-center text-muted text-subtitle">
					{footer}
				</Text>
			) : null}
		</ScrollView>
	);
}
