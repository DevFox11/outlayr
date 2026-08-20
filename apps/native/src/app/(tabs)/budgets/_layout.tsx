import { Stack } from "expo-router";

import { useTranslation } from "@/i18n/context";

export default function BudgetsLayout() {
    const t = useTranslation();
    return (
        <Stack>
            {/* First declared is the initial route: the tab lands on the list. */}
            <Stack.Screen name="index">
                <Stack.Header transparent />
                {/* The toolbar belongs to the screen, which owns the picker it opens. */}
                <Stack.Screen.Title large>{t("budgets.title")}</Stack.Screen.Title>
            </Stack.Screen>
            {/* Declared before `[id]` so the static segment wins the match. */}
            <Stack.Screen name="overall">
                <Stack.Header transparent />
                <Stack.Screen.BackButton displayMode="minimal" />
            </Stack.Screen>
            <Stack.Screen name="[id]">
                <Stack.Header transparent />
                <Stack.Screen.BackButton displayMode="minimal" />
            </Stack.Screen>
            <Stack.Screen name="goals/create" options={{ presentation: "modal" }} />
            <Stack.Screen name="goals/[id]" options={{ presentation: "modal" }} />
        </Stack>
    );
}
