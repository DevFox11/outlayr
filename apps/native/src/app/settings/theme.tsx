import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppTheme } from "@/contexts/app-theme-context";
import { THEME_OPTIONS } from "@/theme/theme-preference";

export default function ThemeScreen() {
	const { themePreference, setThemePreference } = useAppTheme();

	return (
		<SettingsScreen>
			<SettingsSection title="Appearance">
				{THEME_OPTIONS.map((option) => (
					<ChoiceRow
						detail={option.detail}
						key={option.value}
						label={option.label}
						onPress={() => setThemePreference(option.value)}
						selected={themePreference === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
