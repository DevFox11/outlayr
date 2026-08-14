import { Stack, useRouter } from "expo-router";

import { useDatabase } from "@/contexts/local-data-context";
import { useTranslation } from "@/i18n/context";
import { GoalForm } from "@/screens/budgets/components/goal-form";

export default function CreateGoalScreen() {
    const router = useRouter();
    const t = useTranslation();
    const db = useDatabase();

    return (
        <>
            <GoalForm db={db} onDone={() => router.back()} />
            <Stack.Screen.Title>{t("goals.new.title")}</Stack.Screen.Title>
            {/* A modal has no back button, so swipe-down would be the only way out. */}
            <Stack.Toolbar placement="left">
                <Stack.Toolbar.Button onPress={() => router.back()}>{t("budgets.action.cancel")}</Stack.Toolbar.Button>
            </Stack.Toolbar>
        </>
    );
}
