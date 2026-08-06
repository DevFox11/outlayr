import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useTranslation } from "@/i18n";
import { THEME_OPTIONS } from "@/theme/theme-preference";
import { useThemePreference } from "@/theme/use-theme-preference";

export function Theme() {
	const t = useTranslation();
	const { preference, setPreference } = useThemePreference();

	return (
		<SettingsScreen>
			<SettingsSection title={t("settings.section.appearance")}>
				{THEME_OPTIONS.map((option) => (
					<ChoiceRow
						detail={t(option.detail)}
						key={option.value}
						label={t(option.label)}
						onPress={() => setPreference(option.value)}
						selected={preference === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
