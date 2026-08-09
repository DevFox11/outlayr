import { Stack } from "expo-router";
import { useTranslation } from "@/i18n";

export default function SettingsTabLayout() {
	const t = useTranslation();
	return (
		<Stack>
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>{t("settings.screenTitle")}</Stack.Screen.Title>
			</Stack.Screen>
		</Stack>
	);
}
