import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useTransactionCount } from "@/data/transactions";
import { exportFileName, exportTransactionsCsv } from "@/data/transfer-core";
import type { Database } from "@/db/client";
import { CSV_HEADER } from "@/domain/transaction-csv";
import { shareText, TransferError } from "@/lib/data-transfer";
import { useColors } from "@/theme/use-colors";

export default function ExportDataScreen() {
	const db = useDatabase();
	return <ExportData db={db} />;
}

function ExportData({ db }: { db: Database }) {
	const colors = useColors();
	const count = useTransactionCount(db);
	const [busy, setBusy] = useState(false);

	const run = () => {
		setBusy(true);
		exportTransactionsCsv(db)
			.then((csv) =>
				shareText(
					csv,
					exportFileName(new Date()),
					"text/csv",
					"Export transactions",
				),
			)
			.catch((error: unknown) => {
				Alert.alert(
					"Export failed",
					error instanceof TransferError
						? error.message
						: "The file couldn't be written.",
				);
			})
			.finally(() => setBusy(false));
	};

	return (
		<SettingsScreen footer="Deleted transactions are left out. Everything else on this device is written, newest first.">
			<View className="gap-1 pt-6">
				<MonoLabel>Ready to export</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-hero tabular-nums">
					{count}
				</Text>
				<Text className="text-muted text-subtitle">
					{count === 1 ? "transaction" : "transactions"}
				</Text>
			</View>

			<View className="pt-6">
				<Pressable
					accessibilityRole="button"
					className="h-14 items-center justify-center rounded-[28px] bg-foreground active:opacity-70"
					disabled={busy || count === 0}
					onPress={run}
					style={busy || count === 0 ? { opacity: 0.4 } : undefined}
				>
					{busy ? (
						<ActivityIndicator color={colors.background} />
					) : (
						<Text className="font-sans-semibold text-background text-callout">
							Export CSV
						</Text>
					)}
				</Pressable>
			</View>

			<SettingsSection
				footer="Dates are ISO 8601 instants and amounts are plain decimals with no grouping, so the file reads back into Outlayr — or into a spreadsheet — as the same figures."
				title="Columns"
			>
				{CSV_HEADER.map((column) => (
					<View
						className="flex-row items-center border-border border-b py-3"
						key={column}
					>
						<Text className="flex-1 text-body text-foreground">{column}</Text>
					</View>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
