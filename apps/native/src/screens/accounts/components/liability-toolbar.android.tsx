import { Stack, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import type { Account } from "@/data/accounts-core";
import { useTranslation } from "@/i18n/context";

/** An account's ⋯, which opens its editor. Payoff plans come to Android with its own port. */
export function LiabilityToolbar({ account }: { account: Account; plan: unknown }) {
    const router = useRouter();
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
                accessibilityLabel={t("accounts.a11y.edit")}
                onPress={() =>
                    router.push({ params: { accountId: account.id }, pathname: "/accounts/[accountId]/edit" })
                }
            >
                <Stack.Toolbar.Icon {...toolbarIcon("more")} />
            </Stack.Toolbar.Button>
        </Stack.Toolbar>
    );
}
