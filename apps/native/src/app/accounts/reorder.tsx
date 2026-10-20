import { Stack, useRouter } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { AccountReorder } from "@/screens/accounts/reorder";

export default function AccountReorderScreen() {
    const router = useRouter();
    const t = useTranslation();

    return (
        <>
            <Stack.Screen.BackButton displayMode="minimal" />
            <ScreenHeader title={t("accounts.reorderTitle")} />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button accessibilityLabel={t("common.done")} onPress={() => router.back()}>
                    <Stack.Toolbar.Icon {...toolbarIcon("done")} />
                </Stack.Toolbar.Button>
            </Stack.Toolbar>

            <AccountReorder />
        </>
    );
}
