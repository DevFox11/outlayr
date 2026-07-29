import { Stack } from "expo-router";

export default function InsightsLayout() {
	return (
		<Stack>
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>Insights</Stack.Screen.Title>
			</Stack.Screen>
		</Stack>
	);
}
