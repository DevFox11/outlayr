import { Redirect, Stack, useRouter } from "expo-router";

import AccountEditor from "@/components/account-editor";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";

export default function AccountCreateScreen() {
    const router = useRouter();
    const t = useTranslation();
    const createRoute = useAccountCreateRoute();

    // The route is externally addressable through the app's URL scheme, so the
    // cap cannot live only in the callers that push it.
    if (createRoute === "/paywall") {
        return <Redirect href="/paywall" />;
    }

    return (
        <>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>

            <AccountEditor mode="create" />
        </>
    );
}
