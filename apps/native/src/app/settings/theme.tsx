import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useTranslation } from "@/i18n";
import { THEME_OPTIONS } from "@/theme/theme-preference";

export default function ThemeScreen() {
	const t = useTranslation();
	const { themePreference, setThemePreference } = useAppTheme();

	return (
		<SettingsScreen>
			<SettingsSection title={t("settings.section.appearance")}>
				{THEME_OPTIONS.map((option) => (
					<ChoiceRow
						detail={t(option.detail)}
						key={option.value}
						label={t(option.label)}
						onPress={() => setThemePreference(option.value)}
						selected={themePreference === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
