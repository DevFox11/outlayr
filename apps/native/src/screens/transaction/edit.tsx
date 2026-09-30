import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { CloseToolbar } from "@/components/close-toolbar";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions-core";
import { savedTransfer } from "@/data/transfers-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useTranslation } from "@/i18n/context";
import { EditTransfer } from "@/screens/transfers/edit";

export function EditTransaction({ id }: { id: string }) {
    const router = useRouter();
    const { leave, setDirty } = useDiscardGuard();
    const db = useDatabase();
    const t = useTranslation();
    const { requestDelete } = useDeferredDelete("row");
    // Read once, synchronously, while mounting: the database is already open (the
    // splash gate guarantees it) and the driver runs on the JS thread, so the row
    // is in hand for the very first render — the form never mounts empty.
    const [initial] = useState(() => {
        const row = id ? getTransactionById(db, id) : null;
        const purchase = row?.feeForId ? getTransactionById(db, row.feeForId) : null;
        return purchase != null && purchase.deletedAt == null ? purchase : row;
    });
    const [transferId] = useState(() =>
        initial?.transferId != null && savedTransfer(db, initial.transferId) !== null ? initial.transferId : null
    );

    useEffect(() => {
        if (initial == null) {
            router.back();
        }
    }, [initial, router]);

    // No confirmation in front of it: the write is held for the undo window and
    // the toast that offers it is mounted at the app root, so it survives this
    // screen going away — which it does immediately.
    const deleteTransaction = () => {
        if (initial == null) {
            return;
        }
        requestDelete(initial.id);
        leave();
    };

    if (initial == null) {
        return null;
    }
    if (transferId !== null) {
        return <EditTransfer id={transferId} />;
    }

    return (
        <>
            <Stack.Header transparent />
            <Stack.Screen.Title>{t("transaction.edit.title")}</Stack.Screen.Title>
            <CloseToolbar placement="left" />
            <TransactionForm
                db={db}
                initial={initial}
                mode="edit"
                onDelete={deleteTransaction}
                onDirtyChange={setDirty}
                onDone={leave}
            />
        </>
    );
}
