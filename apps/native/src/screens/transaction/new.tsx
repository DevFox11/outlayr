import { Stack, useRouter } from "expo-router";
import { useState } from "react";

import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions-core";
import { logAgainDraft } from "@/domain/transaction-actions";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n/context";

export function NewTransaction({
    income,
    amount,
    note,
    from,
    categoryId,
    accountId,
    accountUnresolved,
    currency,
    date,
    details,
    recurringCoefficient,
    recurringType,
}: {
    income?: string;
    amount?: string;
    note?: string;
    from?: string;
    categoryId?: string;
    accountId?: string;
    accountUnresolved?: string;
    currency?: string;
    /** Epoch milliseconds. */
    date?: string;
    details?: string;
    recurringCoefficient?: string;
    recurringType?: string;
}) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    const seededAmount = amount == null ? Number.NaN : Number.parseFloat(amount);
    const seededDate = date == null ? Number.NaN : Number.parseInt(date, 10);
    const seededType = recurringType == null ? Number.NaN : Number.parseInt(recurringType, 10);
    const seededCoefficient = recurringCoefficient == null ? 1 : Number.parseInt(recurringCoefficient, 10);
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
                    accountId,
                    accountUnresolved: accountUnresolved === "1",
                    amount: Number.isFinite(seededAmount) ? seededAmount : undefined,
                    categoryId,
                    currency,
                    date: Number.isFinite(seededDate) ? new Date(seededDate) : undefined,
                    details,
                    income: income === "1",
                    note,
                    recurrence:
                        Number.isFinite(seededType) && seededType > 0
                            ? {
                                  coefficient: Number.isFinite(seededCoefficient) ? seededCoefficient : 1,
                                  type: seededType,
                              }
                            : undefined,
                }}
            />
        </>
    );
}
