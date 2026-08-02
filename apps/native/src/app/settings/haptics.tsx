import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { HAPTICS_OPTIONS, setNumberSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import { type TranslationKey, useTranslation } from "@/i18n";

const DETAIL = {
	0: "settings.haptics.noneDetail",
	1: "settings.haptics.subtleDetail",
	2: "settings.haptics.excessiveDetail",
} as const satisfies Record<number, TranslationKey>;

export default function HapticsRoute() {
	const db = useDatabase();
	return <Haptics db={db} />;
}

function Haptics({ db }: { db: Database }) {
	const t = useTranslation();
	const { state: settings } = useAppSettings();
	const haptics = settings.number("haptics");

	return (
		<SettingsScreen>
			<SettingsSection title={t("settings.haptics.section")}>
				{HAPTICS_OPTIONS.map((option) => (
					<ChoiceRow
						detail={t(DETAIL[option.value])}
						key={option.value}
						label={t(option.label)}
						onPress={() => {
							setNumberSetting(db, "haptics", option.value);
						}}
						selected={haptics === option.value}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
