import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { type EraseScope, eraseData } from "@/data/erase";
import { useTransactionCount } from "@/data/transactions";
import type { Database } from "@/db/client";

export default function EraseDataRoute() {
	const db = useDatabase();
	return <EraseData db={db} />;
}

function EraseData({ db }: { db: Database }) {
	const router = useRouter();
	const count = useTransactionCount(db);

	const confirm = (scope: EraseScope, title: string, message: string) => {
		Alert.alert(title, message, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Erase",
				style: "destructive",
				onPress: () => {
					eraseData(db, scope).then(() => router.back());
				},
			},
		]);
	};

	return (
		<SettingsScreen>
			<View className="gap-1 pt-6">
				<MonoLabel>On this device</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
					{count}
				</Text>
				<Text className="text-muted text-subtitle">
					{count === 1 ? "transaction logged" : "transactions logged"}
				</Text>
			</View>

			<SettingsSection
				footer="Your categories are kept either way — they are the vocabulary you built, not the records you logged."
				title="Erase"
			>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() =>
						confirm(
							"transactions",
							"Erase transactions?",
							"Every transaction and recurring template will be deleted. Budgets and categories are kept. This can't be undone.",
						)
					}
					title="Transactions only"
				/>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() =>
						confirm(
							"everything",
							"Erase everything?",
							"Every transaction, recurring template and budget will be deleted. Only your categories are kept. This can't be undone.",
						)
					}
					title="Transactions and budgets"
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
