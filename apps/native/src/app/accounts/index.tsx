import { Stack, useRouter } from "expo-router";

import { useToolbarIcon } from "@/components/toolbar-icons";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";
import { Accounts } from "@/screens/accounts";

export default function AccountsScreen() {
    const router = useRouter();
    const t = useTranslation();
    const addIcon = useToolbarIcon("add");
    const createRoute = useAccountCreateRoute();

    return (
        <>
            <Stack.Toolbar placement="bottom">
                <Stack.Toolbar.Spacer />
                {/* `accessibilityLabel` does not survive the bottom placement's image
				    path; a Label child does, and an icon button never draws it. */}
                <Stack.Toolbar.Button
                    {...addIcon}
                    accessibilityLabel={t("accounts.a11y.new")}
                    onPress={() => router.push(createRoute)}
                >
                    <Stack.Toolbar.Label>{t("accounts.a11y.new")}</Stack.Toolbar.Label>
                </Stack.Toolbar.Button>
            </Stack.Toolbar>
            <Accounts />
        </>
    );
}
