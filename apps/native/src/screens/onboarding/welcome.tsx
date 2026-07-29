import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";

/** Swift's `WelcomeSheetView` rows. */
const FEATURES = [
	{
		body: "onboarding.welcome.feature.track.body",
		title: "onboarding.welcome.feature.track.title",
	},
	{
		body: "onboarding.welcome.feature.analyse.body",
		title: "onboarding.welcome.feature.analyse.title",
	},
	{
		body: "onboarding.welcome.feature.budgets.body",
		title: "onboarding.welcome.feature.budgets.title",
	},
] as const;

export default function OnboardingWelcomeScreen() {
	const router = useRouter();
	const t = useTranslation();

	return (
		<View className="flex-1 bg-background px-6 pt-safe-offset-14 pb-safe-offset-5">
			<View className="gap-2">
				<MonoLabel>{t("onboarding.welcome.eyebrow")}</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-hero">
					Outlayr
				</Text>
				<Text className="text-muted text-subtitle">
					{t("onboarding.welcome.subtitle")}
				</Text>
			</View>

			<View className="flex-1 justify-center">
				<View className="border-border border-t">
					{FEATURES.map((feature, index) => (
						<View
							className="flex-row gap-4 border-border border-b py-5"
							key={feature.title}
						>
							<MonoLabel className="w-6 pt-1">
								{String(index + 1).padStart(2, "0")}
							</MonoLabel>
							<View className="flex-1 gap-1">
								<Text className="font-sans-semibold text-callout text-foreground">
									{t(feature.title)}
								</Text>
								<Text className="text-muted text-subtitle">
									{t(feature.body)}
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
					{t("onboarding.welcome.start")}
				</Text>
			</Pressable>
		</View>
	);
}
