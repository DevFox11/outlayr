import { router, Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

export default function BudgetsLayout() {
	const t = useTranslation();
	return (
		<Stack>
			{/* First declared is the initial route: the tab lands on the list. */}
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>{t("budgets.title")}</Stack.Screen.Title>
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						{...toolbarIcon("add")}
						accessibilityLabel={t("budgets.new.a11y")}
						onPress={() => router.push("/(tabs)/budgets/create")}
					/>
				</Stack.Toolbar>
			</Stack.Screen>
			{/* Declared before `[id]` so the static segment wins the match. */}
			<Stack.Screen name="edit/[id]" options={{ presentation: "modal" }} />
			<Stack.Screen name="overall">
				<Stack.Header transparent />
				<Stack.Screen.BackButton displayMode="minimal" />
			</Stack.Screen>
			<Stack.Screen name="[id]">
				<Stack.Header transparent />
				<Stack.Screen.BackButton displayMode="minimal" />
			</Stack.Screen>
			<Stack.Screen name="create" options={{ presentation: "modal" }} />
		</Stack>
	);
}
