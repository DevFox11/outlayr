import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";
import { TabPauseProvider } from "@/navigation/tab-pause-provider";

export default function InsightsLayout() {
    const t = useTranslation();
    return (
        <TabPauseProvider>
            <Stack>
                <Stack.Screen name="index">
                    <Stack.Header transparent />
                    <Stack.Screen.Title large>{t("insights.title")}</Stack.Screen.Title>
                </Stack.Screen>
            </Stack>
        </TabPauseProvider>
    );
}
