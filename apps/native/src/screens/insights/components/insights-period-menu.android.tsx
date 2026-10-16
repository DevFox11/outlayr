import { Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useTranslation } from "@/i18n/context";

import { PERIODS } from "../periods";
import type { InsightsPeriodMenuProps } from "./insights-period-menu";

/**
 * Android drops a label-only root menu, so this one opens from the period
 * icon. The current period reads from the checkmark inside the menu instead
 * of the bar. No toolbar colours, as in the Log's toolbar: they hide the check.
 */
export function InsightsPeriodMenu({ period, onSelect }: InsightsPeriodMenuProps) {
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu {...toolbarIcon("period")} accessibilityLabel={t("insights.period.change")}>
                {PERIODS.map((option) => (
                    <Stack.Toolbar.MenuAction
                        isOn={option.period === period}
                        key={option.value}
                        onPress={() => onSelect(option.value)}
                    >
                        {t(option.labelKey)}
                    </Stack.Toolbar.MenuAction>
                ))}
            </Stack.Toolbar.Menu>
        </Stack.Toolbar>
    );
}
