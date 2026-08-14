import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { toolbarIcon } from "@/components/toolbar-icons";
import { TransactionForm } from "@/components/transaction-form";
import { useDatabase } from "@/contexts/local-data-context";
import { getTransactionById, transactionsRepo } from "@/data/transactions-core";
import { useTranslation } from "@/i18n/context";

export function EditTransaction({ id }: { id: string }) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
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
            t("transaction.delete.title"),
            t("transaction.delete.body"),
            [
                { style: "cancel", text: t("common.cancel") },
                {
                    onPress: async () => {
                        await transactionsRepo.remove(db, id);
                        router.back();
                    },
                    style: "destructive",
                    text: t("common.delete"),
                },
            ],
            { cancelable: true }
        );
    };

    if (initial == null) {
        return null;
    }

    return (
        <>
            <Stack.Header transparent />
            <Stack.Screen.Title>{t("transaction.edit.title")}</Stack.Screen.Title>
            <Stack.Toolbar placement="left">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>
            <TransactionForm
                db={db}
                initial={initial}
                mode="edit"
                onDelete={confirmDelete}
                onDone={() => router.back()}
            />
        </>
    );
}
