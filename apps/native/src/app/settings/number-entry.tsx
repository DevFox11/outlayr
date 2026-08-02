import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { setNumberSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import { type TranslationKey, useTranslation } from "@/i18n";

const ENTRY_OPTIONS: readonly {
	label: TranslationKey;
	detail: TranslationKey;
	value: number;
}[] = [
	{
		label: "settings.numberEntry.type1Title",
		detail: "settings.numberEntry.type1Detail",
		value: 1,
	},
	{
		label: "settings.numberEntry.type2Title",
		detail: "settings.numberEntry.type2Detail",
		value: 2,
	},
];

export default function NumberEntryRoute() {
	const db = useDatabase();
	return <NumberEntry db={db} />;
}

function NumberEntry({ db }: { db: Database }) {
	const t = useTranslation();
	const { state: settings } = useAppSettings();
	const numberEntryType = settings.number("numberEntryType");

	return (
		<SettingsScreen>
			<SettingsSection title={t("settings.numberEntry.section")}>
				{ENTRY_OPTIONS.map((option) => (
					<ChoiceRow
						detail={t(option.detail)}
						key={option.value}
						label={t(option.label)}
						onPress={() => {
							setNumberSetting(db, "numberEntryType", option.value);
						}}
						selected={numberEntryType === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
