import { Stack } from "expo-router";

import { toolbarIcon } from "@/components/toolbar-icons";
import { LOG_PERIOD_ORDER } from "@/data/log-totals";
import { LOG_FILTER_ORDER } from "@/domain/log-filter";
import { useTranslation } from "@/i18n/context";

import { FILTER_ICON, FILTER_LABEL_KEY, PERIOD_PHRASE_KEY } from "../labels";
import type { LogToolbarProps } from "./log-toolbar";

/**
 * The same three actions, all trailing: an M3 app bar's leading slot is the
 * navigation icon, so search sits with period and filter instead of pushing
 * the title along. No `tintColor` or `backgroundColor` on the toolbar: on
 * device the tint hides the menu items' icons and checkmarks, and the
 * background hides the checkmark on items without an icon (the periods).
 */
export function LogToolbar({ period, onPeriod, filter, onFilter, onSearch }: LogToolbarProps) {
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
                {...toolbarIcon("search")}
                accessibilityLabel={t("log.toolbar.search")}
                onPress={onSearch}
            />
            <Stack.Toolbar.Menu {...toolbarIcon("period")} accessibilityLabel={t("log.toolbar.period")}>
                <Stack.Toolbar.Menu inline title={t("log.toolbar.period")}>
                    {LOG_PERIOD_ORDER.map((option) => (
                        <Stack.Toolbar.MenuAction
                            isOn={option === period}
                            key={option}
                            onPress={() => onPeriod(option)}
                        >
                            {t(PERIOD_PHRASE_KEY[option])}
                        </Stack.Toolbar.MenuAction>
                    ))}
                </Stack.Toolbar.Menu>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Menu
                {...toolbarIcon(filter === "all" ? "filter" : "filterActive")}
                accessibilityLabel={t("log.toolbar.filter")}
            >
                <Stack.Toolbar.Menu inline title={t("log.toolbar.show")}>
                    {LOG_FILTER_ORDER.map((option) => (
                        <Stack.Toolbar.MenuAction
                            key={option}
                            {...toolbarIcon(FILTER_ICON[option])}
                            isOn={option === filter}
                            onPress={() => onFilter(option)}
                        >
                            {t(FILTER_LABEL_KEY[option])}
                        </Stack.Toolbar.MenuAction>
                    ))}
                </Stack.Toolbar.Menu>
            </Stack.Toolbar.Menu>
        </Stack.Toolbar>
    );
}
