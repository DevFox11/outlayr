import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { CloseToolbar } from "@/components/close-toolbar";
import { toolbarIcon } from "@/components/toolbar-icons";
import TransferEditor from "@/components/transfer-editor";
import { useDatabase } from "@/contexts/local-data-context";
import { savedTransfer } from "@/data/transfers-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

export function EditTransfer({ id }: { id: string }) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    const colors = useColors();
    const { requestDelete } = useDeferredDelete("row");
    const [saved] = useState(() => savedTransfer(db, id));

    useEffect(() => {
        if (saved === null) {
            router.back();
        }
    }, [saved, router]);

    if (saved === null) {
        return null;
    }

    return (
        <>
            <Stack.Screen.Title>{t("transfers.title")}</Stack.Screen.Title>
            <CloseToolbar placement="left" />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("transfers.delete.row")}
                    onPress={() => {
                        requestDelete(id);
                        router.back();
                    }}
                    tintColor={colors.danger}
                />
            </Stack.Toolbar>

            <TransferEditor onDone={() => router.back()} saved={saved} />
        </>
    );
}
