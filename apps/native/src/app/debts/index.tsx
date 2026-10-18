import { Stack, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useAccountCreateRoute } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";
import { Debts } from "@/screens/debts";

export default function DebtsScreen() {
    const router = useRouter();
    const t = useTranslation();
    const createRoute = useAccountCreateRoute();

    return (
        <>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Menu {...toolbarIcon("add")} accessibilityLabel={t("debts.a11y.add")}>
                    <Stack.Toolbar.MenuAction icon="person" onPress={() => router.push("/debts/new")}>
                        {t("debts.add.person")}
                    </Stack.Toolbar.MenuAction>
                    <Stack.Toolbar.MenuAction
                        icon="creditcard"
                        onPress={() =>
                            router.push(
                                createRoute === "/paywall"
                                    ? createRoute
                                    : { params: { kind: "liability" }, pathname: createRoute }
                            )
                        }
                    >
                        {t("debts.add.liability")}
                    </Stack.Toolbar.MenuAction>
                </Stack.Toolbar.Menu>
            </Stack.Toolbar>
            <Debts />
        </>
    );
}
