import { isPickableCurrency } from "@outlayr/money/currency";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";

import { CloseToolbar } from "@/components/close-toolbar";
import { TransactionForm } from "@/components/transaction-form";
import type { TransactionSeed } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions-core";
import { AMOUNT_CEILING } from "@/domain/numpad";
import { SELECTABLE_RECURRING_TYPES } from "@/domain/recurrence";
import { logAgainDraft } from "@/domain/transaction-actions";
import type { LogAgainDraft } from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n/context";

type LinkParam = string | string[];

interface EntryParams {
    accountId?: LinkParam;
    accountUnresolved?: LinkParam;
    amount?: LinkParam;
    categoryId?: LinkParam;
    currency?: LinkParam;
    /** Epoch milliseconds. */
    date?: LinkParam;
    details?: LinkParam;
    income?: LinkParam;
    note?: LinkParam;
    recurringCoefficient?: LinkParam;
    recurringType?: LinkParam;
}

const PLAIN_DECIMAL = /^\d+(?:\.\d+)?$/;

function single(param: LinkParam | undefined): string | undefined {
    return Array.isArray(param) ? undefined : param;
}

function plainNumber(param: LinkParam | undefined): number {
    const text = single(param) ?? "";
    return PLAIN_DECIMAL.test(text) ? Number(text) : Number.NaN;
}

export function entrySeed({
    accountId,
    accountUnresolved,
    amount,
    categoryId,
    currency,
    date,
    details,
    income,
    note,
    recurringCoefficient,
    recurringType,
}: EntryParams): TransactionSeed {
    const seededAmount = plainNumber(amount);
    const seededDate = new Date(Number.parseInt(single(date) ?? "", 10));
    const seededType = plainNumber(recurringType);
    const seededCoefficient = plainNumber(recurringCoefficient);
    const seededCurrency = single(currency);
    const cadence = SELECTABLE_RECURRING_TYPES.find((type) => type === seededType);
    return {
        accountId: single(accountId),
        accountUnresolved: accountUnresolved === "1",
        amount: seededAmount > 0 && Math.round(seededAmount) < AMOUNT_CEILING ? seededAmount : undefined,
        categoryId: single(categoryId),
        currency: seededCurrency !== undefined && isPickableCurrency(seededCurrency) ? seededCurrency : undefined,
        date: Number.isNaN(seededDate.getTime()) ? undefined : seededDate,
        details: single(details),
        income: income === "1",
        note: single(note),
        recurrence:
            cadence === undefined
                ? undefined
                : {
                      coefficient: Number.isInteger(seededCoefficient) && seededCoefficient > 0 ? seededCoefficient : 1,
                      type: cadence,
                  },
    };
}

export function NewTransaction({ from, ...params }: EntryParams & { from?: LinkParam }) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    // Read once while mounting, as the edit route does: the driver runs on the JS
    // thread, so the copy is in hand for the first render. A row that no longer
    // resolves opens an empty form rather than bouncing — the id came from a menu
    // over a row that may have been deleted behind it.
    const [copyOf] = useState<LogAgainDraft | undefined>(() => {
        const copied = single(from);
        const source = copied ? getTransactionById(db, copied) : null;
        return source ? logAgainDraft(source) : undefined;
    });

    return (
        <>
            <Stack.Header transparent />
            <Stack.Screen.Title>{t("transaction.new.title")}</Stack.Screen.Title>
            <CloseToolbar placement="left" />

            <TransactionForm
                copyOf={copyOf}
                db={db}
                mode="create"
                onDone={() => router.back()}
                seed={entrySeed(params)}
            />
        </>
    );
}
