import { Stack, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import TransferEditor from "@/components/transfer-editor";
import { useTranslation } from "@/i18n/context";

export default function TransferCreateScreen() {
    const router = useRouter();
    const t = useTranslation();

    return (
        <>
            <Stack.Screen.Title>{t("transfers.title")}</Stack.Screen.Title>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>

            <TransferEditor onDone={() => router.back()} />
        </>
    );
}
