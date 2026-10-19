import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";
import { TabPauseProvider } from "@/navigation/tab-pause-provider";

export default function SettingsTabLayout() {
    const t = useTranslation();
    return (
        <TabPauseProvider>
            <Stack>
                <Stack.Screen name="index">
                    <Stack.Header transparent />
                    <Stack.Screen.Title large>{t("settings.screenTitle")}</Stack.Screen.Title>
                </Stack.Screen>
            </Stack>
        </TabPauseProvider>
    );
}
