import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";
import { useAppBarOptions } from "@/navigation/material-chrome";

/** Insights under an opaque M3 small app bar; iOS keeps its transparent large title. */
export default function InsightsLayout() {
    const t = useTranslation();
    const appBar = useAppBarOptions();
    return (
        <Stack screenOptions={appBar}>
            <Stack.Screen name="index" options={{ title: t("insights.title") }} />
        </Stack>
    );
}
