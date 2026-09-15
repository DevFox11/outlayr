import { Stack } from "expo-router";

import AccountEditor from "@/components/account-editor";
import { CloseToolbar } from "@/components/close-toolbar";
import { useTranslation } from "@/i18n/context";

/** The Delete button belongs to the editor: it is the tree that can show a failed delete. */
export function AccountEdit({ id }: { id: string }) {
    const t = useTranslation();

    return (
        <>
            <Stack.Screen.Title>{t("accounts.nav.edit")}</Stack.Screen.Title>

            <CloseToolbar placement="left" />

            <AccountEditor id={id} mode="edit" />
        </>
    );
}
