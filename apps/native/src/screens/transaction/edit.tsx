import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { CloseToolbar } from "@/components/close-toolbar";
import { RestingSheetFrame } from "@/components/resting-sheet-frame";
import { ScreenHeader } from "@/components/screen-header";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById } from "@/data/transactions-core";
import type { Transaction } from "@/data/transactions-core";
import { savedTransfer } from "@/data/transfers-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useRestingSheet } from "@/hooks/use-resting-sheet";
import { useTranslation } from "@/i18n/context";
import { EditTransfer } from "@/screens/transfers/edit";

export function EditTransaction({ id }: { id: string }) {
    const router = useRouter();
    const db = useDatabase();
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

    if (initial == null) {
        return null;
    }
    if (transferId !== null) {
        return <EditTransfer id={transferId} />;
    }
    return <TransactionSheet initial={initial} />;
}

function TransactionSheet({ initial }: { initial: Transaction }) {
    const { leave, setDirty } = useDiscardGuard();
    const db = useDatabase();
    const t = useTranslation();
    const { requestDelete } = useDeferredDelete("row");
    const { awake, height, rest, sheet } = useRestingSheet(t("transaction.edit.title"));

    // No confirmation in front of it: the write is held for the undo window and
    // the toast that offers it is mounted at the app root, so it survives this
    // screen going away — which it does immediately.
    const deleteTransaction = () => {
        requestDelete(initial.id);
        leave();
    };

    return (
        <>
            <Stack.Screen options={sheet} />
            <ScreenHeader title={awake ? t("transaction.edit.title") : undefined} />
            <CloseToolbar placement="left" />
            <RestingSheetFrame height={height}>
                <TransactionForm
                    db={db}
                    initial={initial}
                    mode="edit"
                    onDelete={deleteTransaction}
                    onDirtyChange={setDirty}
                    onDone={leave}
                    rest={rest}
                />
            </RestingSheetFrame>
        </>
    );
}
