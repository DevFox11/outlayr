import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions-core";
import { type LogAgainDraft, logAgainDraft } from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n/context";

export function NewTransaction({
	income,
	amount,
	note,
	from,
}: {
	income?: string;
	amount?: string;
	note?: string;
	from?: string;
}) {
	const router = useRouter();
	const db = useDatabase();
	const t = useTranslation();
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
					amount: Number.isFinite(seededAmount) ? seededAmount : undefined,
					income: income === "1",
					note,
				}}
			/>
		</>
	);
}
