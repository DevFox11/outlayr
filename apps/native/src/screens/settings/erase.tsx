import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { type EraseResidue, type EraseScope, eraseData } from "@/data/erase";
import { useTransactionCount } from "@/data/transactions";
import type { Database } from "@/db/client";
import { type TranslationKey, useTranslation } from "@/i18n";
import { clearStoredPhotos } from "@/lib/photo-storage";
import { clearSpotlight } from "@/lib/spotlight";

const RESIDUE: EraseResidue = { clearSpotlight, clearStoredPhotos };

export function EraseData() {
	const db = useDatabase();
	return <EraseDataContent db={db} />;
}

function EraseDataContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const count = useTransactionCount(db);

	const confirm = (scope: EraseScope, title: TranslationKey, message: TranslationKey) => {
		Alert.alert(t(title), t(message), [
			{ style: "cancel", text: t("common.cancel") },
			{
				onPress: () => {
					eraseData(db, scope, RESIDUE)
						.then(() => router.back())
						.catch((error: unknown) => {
							console.error("Erase failed", error);
							Alert.alert(t("settings.erase.failedTitle"), t("settings.erase.failedBody"));
						});
				},
				style: "destructive",
				text: t("settings.erase.action"),
			},
		]);
	};

	return (
		<SettingsScreen>
			<View className="gap-1 pt-6">
				<MonoLabel>{t("settings.erase.onThisDevice")}</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-hero tabular-nums">{count}</Text>
				<Text className="text-muted text-subtitle">
					{count === 1 ? t("settings.erase.transactionLogged") : t("settings.erase.transactionsLogged")}
				</Text>
			</View>

			<SettingsSection footer={t("settings.erase.footer")} title={t("settings.erase.section")}>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() =>
						confirm("transactions", "settings.erase.confirmTransactionsTitle", "settings.erase.confirmTransactionsBody")
					}
					title={t("settings.erase.transactionsOnly")}
				/>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() =>
						confirm("everything", "settings.erase.confirmEverythingTitle", "settings.erase.confirmEverythingBody")
					}
					title={t("settings.erase.transactionsAndBudgets")}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
