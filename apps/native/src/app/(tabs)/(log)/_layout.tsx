import { Stack } from "expo-router";

export default function LogLayout() {
	return (
		<Stack>
			<Stack.Screen name="index">
				<Stack.Header transparent />
				<Stack.Screen.Title large>Log</Stack.Screen.Title>
			</Stack.Screen>
		</Stack>
	);
}
