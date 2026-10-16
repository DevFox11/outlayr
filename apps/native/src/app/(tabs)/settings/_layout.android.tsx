import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";
import { useAppBarOptions } from "@/navigation/material-chrome";

/** Settings under an opaque M3 small app bar; iOS keeps its transparent large title. */
export default function SettingsTabLayout() {
    const t = useTranslation();
    const appBar = useAppBarOptions();
    return (
        <Stack screenOptions={appBar}>
            <Stack.Screen name="index" options={{ title: t("settings.screenTitle") }} />
        </Stack>
    );
}
