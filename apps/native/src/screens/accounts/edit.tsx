import { Stack, useRouter } from "expo-router";

import AccountEditor from "@/components/account-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

/** The Delete button belongs to the editor: it is the tree that can show a failed delete. */
export function AccountEdit({ id }: { id: string }) {
    const router = useRouter();
    const t = useTranslation();

    return (
        <>
            <Stack.Screen.Title>{t("accounts.nav.edit")}</Stack.Screen.Title>

            <Stack.Toolbar placement="left">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>

            <AccountEditor id={id} mode="edit" />
        </>
    );
}
