import Constants from "expo-constants";
import { openBrowserAsync } from "expo-web-browser";
import { View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";

const OUTLAYR_REPO = "https://github.com/danestves/outlayr";
const DIME_REPO = "https://github.com/rafsoh/dimeApp";
const GPL_LICENSE = "https://www.gnu.org/licenses/gpl-3.0.html";
const LOGO_DEV = "https://logo.dev";

export function About() {
	const t = useTranslation();
	const version = Constants.expoConfig?.version ?? "1.0.0";

	const open = (url: string) => {
		openBrowserAsync(url);
	};

	return (
		<SettingsScreen footer={t("settings.about.version", { version })}>
			<View className="pt-6">
				<Text className="text-body text-foreground leading-relaxed">{t("settings.about.intro")}</Text>
			</View>

			<SettingsSection title={t("settings.about.links")}>
				<LinkRow icon="SourceCode" onPress={() => open(OUTLAYR_REPO)} title={t("settings.about.outlayrRepo")} />
				<LinkRow icon="Favourite" onPress={() => open(DIME_REPO)} title={t("settings.about.dimeRepo")} />
				<LinkRow icon="License" onPress={() => open(GPL_LICENSE)} title={t("settings.about.gplLink")} />
				{/* Required by logo.dev's free plan: a visible, followable link. */}
				<LinkRow icon="Sparkles" onPress={() => open(LOGO_DEV)} title={t("settings.about.logoDev")} />
			</SettingsSection>

			<View className="gap-2 pt-8">
				<MonoLabel>{t("settings.about.licenceHeading")}</MonoLabel>
				<Text className="text-muted text-subtitle leading-relaxed">{t("settings.about.fork")}</Text>
				<Text className="text-muted text-subtitle leading-relaxed">{t("settings.about.copyright")}</Text>
				<Text className="text-muted text-subtitle leading-relaxed">{t("settings.about.warranty")}</Text>
			</View>
		</SettingsScreen>
	);
}
