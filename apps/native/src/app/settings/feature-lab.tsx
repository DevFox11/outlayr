import { SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting, useAllSettings } from "@/data/settings";
import type { Database } from "@/db/client";

export default function FeatureLabScreen() {
	const db = useDatabase();
	return <FeatureLabContent db={db} />;
}

function FeatureLabContent({ db }: { db: Database }) {
	const settings = useAllSettings(db);
	const confetti = settings.bool("confetti");
	const lineGraph = settings.bool("logViewLineGraph");
	const swapTimeLabel = settings.bool("swapTimeLabel");
	const budgetRows = settings.bool("budgetViewStyle");

	return (
		<SettingsScreen>
			<SettingsSection
				footer="Throws confetti over a transaction the moment you add it."
				title="Adding a transaction"
			>
				<ToggleRow
					icon="Sparkles"
					onValueChange={(next) => {
						setBoolSetting(db, "confetti", next);
					}}
					title="Celebrate Expenses"
					value={confetti}
				/>
			</SettingsSection>

			<SettingsSection
				footer="Experimental — these can change or disappear."
				title="The Log"
			>
				<ToggleRow
					icon="ChartLineData01"
					onValueChange={(next) => {
						setBoolSetting(db, "logViewLineGraph", next);
					}}
					title="Show Line Graph"
					value={lineGraph}
				/>
			</SettingsSection>

			<SettingsSection
				footer="Off lays the budgets out as a two-up grid of cards instead of a list."
				title="Budgets"
			>
				<ToggleRow
					icon="LayoutTable01"
					onValueChange={(next) => {
						setBoolSetting(db, "budgetViewStyle", next);
					}}
					title="Budget Rows"
					value={budgetRows}
				/>
			</SettingsSection>

			<SettingsSection
				footer="Each transaction shows its category instead of its time. If you never write your own note, the note is already the category name, so both lines will read the same."
				title="Transaction rows"
			>
				<ToggleRow
					icon="TextFont"
					onValueChange={(next) => {
						setBoolSetting(db, "swapTimeLabel", next);
					}}
					title="Replace Time Label"
					value={swapTimeLabel}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
