import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";

export default function LogLayout() {
	const t = useTranslation();
	return (
		<Stack>
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>{t("log.title")}</Stack.Screen.Title>
			</Stack.Screen>
		</Stack>
	);
}
