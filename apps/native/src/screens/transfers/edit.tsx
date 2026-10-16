import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { CloseToolbar } from "@/components/close-toolbar";
import { RestingSheetFrame } from "@/components/resting-sheet-frame";
import { ScreenHeader } from "@/components/screen-header";
import TransferEditor from "@/components/transfer-editor";
import { useDatabase } from "@/contexts/local-data-context";
import { savedTransfer } from "@/data/transfers-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useRestingSheet } from "@/hooks/use-resting-sheet";
import { useTranslation } from "@/i18n/context";

export function EditTransfer({ id }: { id: string }) {
    const router = useRouter();
    const { leave, setDirty } = useDiscardGuard();
    const db = useDatabase();
    const t = useTranslation();
    const { requestDelete } = useDeferredDelete("row");
    const { awake, height, rest, sheet } = useRestingSheet(t("transfers.title"));
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
            <Stack.Screen options={sheet} />
            <ScreenHeader title={awake ? t("transfers.title") : undefined} />
            <CloseToolbar placement="left" />

            <RestingSheetFrame height={height}>
                <TransferEditor
                    onDelete={() => {
                        requestDelete(id);
                        leave();
                    }}
                    onDirtyChange={setDirty}
                    onDone={leave}
                    rest={rest}
                    saved={saved}
                />
            </RestingSheetFrame>
        </>
    );
}
