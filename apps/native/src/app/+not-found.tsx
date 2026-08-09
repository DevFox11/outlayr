import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";

/**
 * Replaces expo-router's built-in `Unmatched` screen, which links to
 * `/_sitemap` — a developer surface a shipped build must never show. Reachable
 * from any malformed `outlayr://` deep link.
 */
export default function NotFoundScreen() {
	const t = useTranslation();
	return (
		<>
			<Stack.Title>{t("notFound.navTitle")}</Stack.Title>
			<View className="flex-1 items-center justify-center bg-background px-8">
				<Text className="pb-2 font-sans-semibold text-foreground text-title">{t("notFound.title")}</Text>
				<Text className="pb-6 text-center text-muted text-subtitle">{t("notFound.body")}</Text>
				<Link href="/">
					<Text className="font-sans-semibold text-subtitle text-tint">{t("notFound.action")}</Text>
				</Link>
			</View>
		</>
	);
}
