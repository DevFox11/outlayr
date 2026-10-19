import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";
import { useAppBarOptions } from "@/navigation/material-chrome";
import { TabPauseProvider } from "@/navigation/tab-pause-provider";

/** The Log tab under an opaque M3 small app bar; iOS keeps its transparent large title. */
export default function LogLayout() {
    const t = useTranslation();
    const appBar = useAppBarOptions();
    return (
        <TabPauseProvider>
            <Stack screenOptions={appBar}>
                <Stack.Screen name="index" options={{ title: t("log.title") }} />
            </Stack>
        </TabPauseProvider>
    );
}
