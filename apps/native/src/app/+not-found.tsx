import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/text";

/**
 * Replaces expo-router's built-in `Unmatched` screen, which links to
 * `/_sitemap` — a developer surface a shipped build must never show. Reachable
 * from any malformed `outlayr://` deep link.
 */
export default function NotFoundScreen() {
	return (
		<>
			<Stack.Title>Not Found</Stack.Title>
			<View className="flex-1 items-center justify-center bg-background px-8">
				<Text className="pb-2 font-sans-semibold text-foreground text-title">
					Nothing Here
				</Text>
				<Text className="pb-6 text-center text-muted text-subtitle">
					That link does not point anywhere in Outlayr. Your ledger is where you
					left it.
				</Text>
				<Link href="/">
					<Text className="font-sans-semibold text-subtitle text-tint">
						Back to the Log
					</Text>
				</Link>
			</View>
		</>
	);
}
