import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useDatabase } from "@/contexts/local-data-context";
import { useSavingsGoals } from "@/data/savings-goals";
import { savingsGoalsRepo } from "@/data/savings-goals-core";
import { useTranslation } from "@/i18n/context";
import { GoalForm } from "@/screens/budgets/components/goal-form";

export default function EditGoalScreen() {
    const router = useRouter();
    const t = useTranslation();
    const db = useDatabase();
    const { id } = useLocalSearchParams<{ id: string }>();
    const goal = useSavingsGoals(db).find((candidate) => candidate.goal.id === id)?.goal;

    if (goal == null) {
        return null;
    }

    return (
        <>
            <GoalForm db={db} initial={goal} onDone={() => router.back()} />
            <Stack.Screen.Title>{t("goals.edit.title")}</Stack.Screen.Title>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("common.delete")}
                    onPress={async () => {
                        await savingsGoalsRepo.remove(db, goal.id);
                        router.back();
                    }}
                />
            </Stack.Toolbar>
        </>
    );
}
