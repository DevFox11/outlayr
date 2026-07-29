import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useUpcomingTransactions } from "@/data/log-filtered";
import { setBoolSetting, useAllSettings } from "@/data/settings";
import type { Database } from "@/db/client";
import { LogUpcoming } from "@/screens/log/components/log-upcoming";

export default function UpcomingScreen() {
	const db = useDatabase();
	return <UpcomingContent db={db} />;
}

function UpcomingContent({ db }: { db: Database }) {
	const router = useRouter();
	const settings = useAllSettings(db);
	const currency = useGlobalCurrency(db);
	const showUpcoming = settings.bool("showUpcoming");
	const showSoon = settings.bool("showUpcomingSoon");
	const [nowMs] = useState(() => Date.now());
	// Unlimited whatever the 14-day toggle says, matching Swift's
	// `limitedMode: false` and the promise the footer above makes.
	const upcoming = useUpcomingTransactions(db, nowMs, false);

	return (
		<SettingsScreen>
			<SettingsSection
				footer="Transactions dated in the future sit at the top of the Log, above today. Hiding them there never hides them here."
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

			<View className="pt-4">
				<LogUpcoming
					currency={currency}
					nowMs={nowMs}
					onPress={(id) => router.push(`/transaction/${id}`)}
					showCents={settings.bool("showCents")}
					showSign={settings.bool("showExpenseOrIncomeSign")}
					swapTimeLabel={settings.bool("swapTimeLabel")}
					transactions={upcoming}
				/>
				{upcoming.length === 0 ? (
					<Text className="pt-2 text-muted text-subtitle leading-snug">
						Nothing is scheduled ahead of today.
					</Text>
				) : null}
			</View>
		</SettingsScreen>
	);
}
