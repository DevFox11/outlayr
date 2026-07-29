import { SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting, useAllSettings } from "@/data/settings";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n";

export default function FeatureLabScreen() {
	const db = useDatabase();
	return <FeatureLabContent db={db} />;
}

function FeatureLabContent({ db }: { db: Database }) {
	const t = useTranslation();
	const settings = useAllSettings(db);
	const confetti = settings.bool("confetti");
	const lineGraph = settings.bool("logViewLineGraph");
	const swapTimeLabel = settings.bool("swapTimeLabel");
	const budgetRows = settings.bool("budgetViewStyle");

	return (
		<SettingsScreen>
			<SettingsSection
				footer={t("settings.featureLab.confettiNote")}
				title={t("settings.featureLab.addingSection")}
			>
				<ToggleRow
					icon="Sparkles"
					onValueChange={(next) => {
						setBoolSetting(db, "confetti", next);
					}}
					title={t("settings.featureLab.confetti")}
					value={confetti}
				/>
			</SettingsSection>

			<SettingsSection
				footer={t("settings.featureLab.experimental")}
				title={t("settings.section.log")}
			>
				<ToggleRow
					icon="ChartLineData01"
					onValueChange={(next) => {
						setBoolSetting(db, "logViewLineGraph", next);
					}}
					title={t("settings.featureLab.lineGraph")}
					value={lineGraph}
				/>
			</SettingsSection>

			<SettingsSection
				footer={t("settings.featureLab.budgetRowsNote")}
				title={t("settings.featureLab.budgetsSection")}
			>
				<ToggleRow
					icon="LayoutTable01"
					onValueChange={(next) => {
						setBoolSetting(db, "budgetViewStyle", next);
					}}
					title={t("settings.featureLab.budgetRows")}
					value={budgetRows}
				/>
			</SettingsSection>

			<SettingsSection
				footer={t("settings.featureLab.swapTimeNote")}
				title={t("settings.featureLab.transactionRowsSection")}
			>
				<ToggleRow
					icon="TextFont"
					onValueChange={(next) => {
						setBoolSetting(db, "swapTimeLabel", next);
					}}
					title={t("settings.featureLab.swapTime")}
					value={swapTimeLabel}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
