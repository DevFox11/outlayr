import { Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

import type { BudgetDetailToolbarProps } from "./budget-detail-toolbar";

export type { BudgetDetailToolbarProps } from "./budget-detail-toolbar";

/**
 * The same menu, with the delete glyph as an image: Android drops SF Symbol
 * names. No `tintColor` or `backgroundColor` on the toolbar: on Android they
 * stop the menu items' icons and checkmarks from drawing (chrome contract).
 */
export function BudgetDetailToolbar({ onDelete }: BudgetDetailToolbarProps) {
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu {...toolbarIcon("more")} accessibilityLabel={t("budgets.action.moreA11y")}>
                <Stack.Toolbar.MenuAction {...toolbarIcon("delete")} destructive onPress={onDelete}>
                    {t("common.delete")}
                </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
        </Stack.Toolbar>
    );
}
