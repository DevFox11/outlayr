import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById, transactionsRepo } from "@/data/transactions";
import { useColors } from "@/theme/use-colors";

export default function EditTransactionScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const db = useDatabase();
	const colors = useColors();
	// Read once, synchronously, while mounting: the database is already open (the
	// splash gate guarantees it) and the driver runs on the JS thread, so the row
	// is in hand for the very first render — the form never mounts empty.
	const [initial] = useState(() => (id ? getTransactionById(db, id) : null));

	useEffect(() => {
		if (initial == null) {
			router.back();
		}
	}, [initial, router]);

	const confirmDelete = () => {
		if (!id) {
			return;
		}
		Alert.alert(
			"Delete transaction?",
			"This action cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						await transactionsRepo.remove(db, id);
						router.back();
					},
				},
			],
			{ cancelable: true },
		);
	};

	if (initial == null) {
		return null;
	}

	return (
		<>
			<Stack.Header transparent />
			<Stack.Screen.Title>Edit Transaction</Stack.Screen.Title>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					{...toolbarIcon("delete")}
					accessibilityLabel="Delete"
					tintColor={colors.danger}
					onPress={confirmDelete}
				/>
			</Stack.Toolbar>

			<TransactionForm
				db={db}
				mode="edit"
				initial={initial}
				onDone={() => router.back()}
			/>
		</>
	);
}
