import { Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

export interface BudgetDetailToolbarProps {
    onDelete: () => void;
}

/**
 * A menu on the bar button, not an alert behind it: these are neutral choices,
 * and the delete asks its own question.
 */
export function BudgetDetailToolbar({ onDelete }: BudgetDetailToolbarProps) {
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu accessibilityLabel={t("budgets.action.moreA11y")}>
                <Stack.Toolbar.Icon {...toolbarIcon("more")} />
                <Stack.Toolbar.MenuAction destructive icon="trash" onPress={onDelete}>
                    {t("common.delete")}
                </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
        </Stack.Toolbar>
    );
}
