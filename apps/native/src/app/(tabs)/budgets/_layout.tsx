import { router, Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";

export default function BudgetsLayout() {
	return (
		<Stack>
			{/* First declared is the initial route: the tab lands on the list. */}
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>Budgets</Stack.Screen.Title>
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						{...toolbarIcon("add")}
						accessibilityLabel="New budget"
						onPress={() => router.push("/(tabs)/budgets/create")}
					/>
				</Stack.Toolbar>
			</Stack.Screen>
			{/* Declared before `[id]` so the static segment wins the match. */}
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
