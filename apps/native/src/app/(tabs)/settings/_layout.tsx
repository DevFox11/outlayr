import { Stack } from "expo-router";

export default function SettingsTabLayout() {
	return (
		<Stack>
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>Settings</Stack.Screen.Title>
			</Stack.Screen>
		</Stack>
	);
}
