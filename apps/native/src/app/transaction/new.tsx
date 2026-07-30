import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions";
import {
	type LogAgainDraft,
	logAgainDraft,
} from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n";

export default function NewTransactionScreen() {
	const router = useRouter();
	const db = useDatabase();
	const t = useTranslation();
	// `income`/`amount`/`note` are set only by the surfaces that open this screen
	// from outside the bundle — the "Log Income" quick action, or a Siri intent
	// handing off a draft. `from` is the opposite direction: a row already on the
	// ledger asking to be logged again, which is why it may fill in the fields a
	// suggestion from outside may not.
	const { income, amount, note, from } = useLocalSearchParams<{
		income?: string;
		amount?: string;
		note?: string;
		from?: string;
	}>();
	const seededAmount = amount == null ? Number.NaN : Number.parseFloat(amount);
	// Read once while mounting, as the edit route does: the driver runs on the JS
	// thread, so the copy is in hand for the first render. A row that no longer
	// resolves opens an empty form rather than bouncing — the id came from a menu
	// over a row that may have been deleted behind it.
	const [copyOf] = useState<LogAgainDraft | undefined>(() => {
		const source = from ? getTransactionById(db, from) : null;
		return source ? logAgainDraft(source) : undefined;
	});

	return (
		<>
			<Stack.Header transparent />
			<Stack.Screen.Title>{t("transaction.new.title")}</Stack.Screen.Title>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					{...toolbarIcon("close")}
					accessibilityLabel={t("common.close")}
					onPress={() => router.back()}
				/>
			</Stack.Toolbar>

			<TransactionForm
				copyOf={copyOf}
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
