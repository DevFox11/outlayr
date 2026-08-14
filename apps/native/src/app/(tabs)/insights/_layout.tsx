import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";

export default function InsightsLayout() {
    const t = useTranslation();
    return (
        <Stack>
            <Stack.Screen name="index">
                <Stack.Header transparent />
                <Stack.Screen.Title large>{t("insights.title")}</Stack.Screen.Title>
            </Stack.Screen>
        </Stack>
    );
}
