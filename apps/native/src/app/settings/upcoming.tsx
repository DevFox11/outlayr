import { SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting, useAllSettings } from "@/data/settings";
import type { Database } from "@/db/client";

export default function UpcomingScreen() {
	const db = useDatabase();
	return <UpcomingContent db={db} />;
}

function UpcomingContent({ db }: { db: Database }) {
	const settings = useAllSettings(db);
	const showUpcoming = settings.bool("showUpcoming");
	const showSoon = settings.bool("showUpcomingSoon");

	return (
		<SettingsScreen>
			<SettingsSection
				footer="Transactions dated in the future sit at the top of the Log, above today."
				title="On the Log"
			>
				<ToggleRow
					icon="Sunrise"
					onValueChange={(next) => {
						setBoolSetting(db, "showUpcoming", next);
						if (!next) {
							setBoolSetting(db, "showUpcomingSoon", false);
						}
					}}
					title="Display on Log Page"
					value={showUpcoming}
				/>
				<ToggleRow
					icon="CalendarClock"
					onValueChange={(next) => {
						setBoolSetting(db, "showUpcomingSoon", next);
					}}
					title="Limit to 14-Day Outlook"
					value={showSoon}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
