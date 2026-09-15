import { Stack, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

export function CloseToolbar({ placement }: { placement: "left" | "right" }) {
    const router = useRouter();
    const t = useTranslation();
    return (
        <Stack.Toolbar placement={placement}>
            <Stack.Toolbar.Button
                {...toolbarIcon("close")}
                accessibilityLabel={t("common.close")}
                onPress={() => router.back()}
            />
        </Stack.Toolbar>
    );
}
