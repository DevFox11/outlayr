import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";

export default function NewTransactionScreen() {
	const router = useRouter();
	const db = useDatabase();
	// Set only by the surfaces that open this screen from outside the bundle — the
	// "Log Income" quick action, or a Siri intent handing off a draft.
	const { income, amount, note } = useLocalSearchParams<{
		income?: string;
		amount?: string;
		note?: string;
	}>();
	const seededAmount = amount == null ? Number.NaN : Number.parseFloat(amount);

	return (
		<>
			<Stack.Header transparent />
			<Stack.Screen.Title>Create Transaction</Stack.Screen.Title>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel="Close"
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<TransactionForm
				db={db}
				mode="create"
				onDone={() => router.back()}
				seed={{
					income: income === "1",
					amount: Number.isFinite(seededAmount) ? seededAmount : undefined,
					note,
				}}
			/>
		</>
	);
}
