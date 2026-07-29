import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";

/** Swift's `WelcomeSheetView` rows, verbatim. */
const FEATURES = [
	{
		header: "Track your finances",
		subtitle: "Add new entries in a simple, straightforward manner",
	},
	{
		header: "Analyse your expenditure",
		subtitle: "Draw insights from your spending over various time periods",
	},
	{
		header: "Stick to budgets",
		subtitle: "Set categorical and time-based goals to limit your spending",
	},
] as const;

export default function OnboardingWelcomeScreen() {
	const router = useRouter();

	return (
		<View className="flex-1 bg-background px-6 pt-safe-offset-14 pb-safe-offset-5">
			<View className="gap-2">
				<MonoLabel>Welcome</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-hero">
					Outlayr
				</Text>
				<Text className="text-muted text-subtitle">
					A ledger you keep by hand — every entry yours, on this device.
				</Text>
			</View>

			<View className="flex-1 justify-center">
				<View className="border-border border-t">
					{FEATURES.map((feature, index) => (
						<View
							className="flex-row gap-4 border-border border-b py-5"
							key={feature.header}
						>
							<MonoLabel className="w-6 pt-1">
								{String(index + 1).padStart(2, "0")}
							</MonoLabel>
							<View className="flex-1 gap-1">
								<Text className="font-sans-semibold text-callout text-foreground">
									{feature.header}
								</Text>
								<Text className="text-muted text-subtitle">
									{feature.subtitle}
								</Text>
							</View>
						</View>
					))}
				</View>
			</View>

			<Pressable
				accessibilityRole="button"
				className="items-center rounded-full bg-accent px-7 py-3.5 active:opacity-80"
				onPress={() => router.push("/onboarding/currency")}
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					Get Started
				</Text>
			</Pressable>
		</View>
	);
}
