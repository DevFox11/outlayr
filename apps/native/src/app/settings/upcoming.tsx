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
import { useDeferredDelete } from "@/data/use-deferred-delete";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { LogUpcoming } from "@/screens/log/components/log-upcoming";
import { UndoToast } from "@/screens/log/components/undo-toast";

export default function UpcomingScreen() {
	const db = useDatabase();
	return <UpcomingContent db={db} />;
}

function UpcomingContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const settings = useAllSettings(db);
	const currency = useGlobalCurrency(db);
	const showUpcoming = settings.bool("showUpcoming");
	const showSoon = settings.bool("showUpcomingSoon");
	const [nowMs] = useState(() => Date.now());
	// Unlimited whatever the 14-day toggle says, matching Swift's
	// `limitedMode: false` and the promise the footer above makes.
	const scheduled = useUpcomingTransactions(db, nowMs, false);
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);
	const openRowActions = useTransactionRowActions(db, nowMs, requestDelete);
	const upcoming = scheduled.filter((row) => row.id !== pendingId);

	return (
		<>
			<SettingsScreen>
				<SettingsSection
					footer={t("settings.upcoming.footer")}
					title={t("settings.upcoming.section")}
				>
					<ToggleRow
						icon="Sunrise"
						onValueChange={(next) => {
							setBoolSetting(db, "showUpcoming", next);
							if (!next) {
								setBoolSetting(db, "showUpcomingSoon", false);
							}
						}}
						title={t("settings.upcoming.displayOnLog")}
						value={showUpcoming}
					/>
					<ToggleRow
						icon="CalendarClock"
						onValueChange={(next) => {
							setBoolSetting(db, "showUpcomingSoon", next);
						}}
						title={t("settings.upcoming.limitToSoon")}
						value={showSoon}
					/>
				</SettingsSection>

				<View className="pt-4">
					<LogUpcoming
						currency={currency}
						nowMs={nowMs}
						onLongPress={(id) => openRowActions(id, true)}
						onPress={(id) => router.push(`/transaction/${id}`)}
						showCents={settings.bool("showCents")}
						showSign={settings.bool("showExpenseOrIncomeSign")}
						swapTimeLabel={settings.bool("swapTimeLabel")}
						transactions={upcoming}
					/>
					{upcoming.length === 0 ? (
						<Text className="pt-2 text-muted text-subtitle leading-snug">
							{t("settings.upcoming.empty")}
						</Text>
					) : null}
				</View>
			</SettingsScreen>
			<UndoToast onUndo={undo} visible={pendingId != null} />
		</>
	);
}
