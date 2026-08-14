import { Stack, useRouter } from "expo-router";

import AccountEditor, { confirmAccountDelete } from "@/components/account-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

export function AccountEdit({ id }: { id: string }) {
    const router = useRouter();
    const db = useDatabase();
    const t = useTranslation();
    const colors = useColors();
    const haptics = useHaptics();

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
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("common.delete")}
                    onPress={() => {
                        confirmAccountDelete(db, id, t, () => {
                            haptics("warning");
                            router.back();
                        });
                    }}
                    tintColor={colors.danger}
                />
            </Stack.Toolbar>

            <AccountEditor id={id} mode="edit" />
        </>
    );
}
