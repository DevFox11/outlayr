import { Stack, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";
import { Paywall } from "@/screens/paywall";

export default function PaywallScreen() {
    const router = useRouter();
    const t = useTranslation();

    return (
        <>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("close")}
                    accessibilityLabel={t("common.close")}
                    onPress={() => router.back()}
                />
            </Stack.Toolbar>
            <Paywall />
        </>
    );
}
