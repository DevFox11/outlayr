import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import {
	LANGUAGE_OPTIONS,
	languageLabel,
	useLanguage,
	useTranslation,
} from "@/i18n";

export default function LanguageScreen() {
	const t = useTranslation();
	const { preference, setPreference } = useLanguage();

	return (
		<SettingsScreen>
			<SettingsSection
				footer={t("language.footer")}
				title={t("language.section")}
			>
				{LANGUAGE_OPTIONS.map((option) => (
					<ChoiceRow
						detail={
							option.value === "system" ? t("language.systemDetail") : undefined
						}
						key={option.value}
						label={
							option.value === "system"
								? t("language.system")
								: languageLabel(option.value)
						}
						onPress={() => setPreference(option.value)}
						selected={preference === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
