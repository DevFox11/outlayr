import { NativeTabs } from "expo-router/native-tabs";
import { useMemo } from "react";

import budgetsSelectedIcon from "@/assets/tab-icons/budgets-selected.png";
import budgetsIcon from "@/assets/tab-icons/budgets.png";
import insightsSelectedIcon from "@/assets/tab-icons/insights-selected.png";
import insightsIcon from "@/assets/tab-icons/insights.png";
import logSelectedIcon from "@/assets/tab-icons/log-selected.png";
import logIcon from "@/assets/tab-icons/log.png";
import settingsSelectedIcon from "@/assets/tab-icons/settings-selected.png";
import settingsIcon from "@/assets/tab-icons/settings.png";
import { useDatabase } from "@/contexts/local-data-context";
import { useOverBudgetCount } from "@/data/budgets";
import { useNow } from "@/data/use-now";
import { useTranslation } from "@/i18n/context";
import { NAV_LABEL_FONT, NAV_LABEL_SIZE } from "@/navigation/material-chrome";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

const PRESSED_ALPHA = 0.1;

/**
 * The M3 navigation bar: `surfaceContainer` behind, the selected tab in a
 * `secondaryContainer` pill, every colour set from the app's own scheme so
 * none falls back to the raw wallpaper palette. Labels always show, and back
 * from any other tab returns to the Log before it leaves the app.
 */
export default function TabLayout() {
    const m3 = useMaterialColors();
    const t = useTranslation();
    const db = useDatabase();
    const nowMs = useNow();
    const overBudget = useOverBudgetCount(db, nowMs);

    // The family carries the weight: Android can't pick one out of a named face.
    const labelStyle = useMemo(
        () => ({
            default: { color: m3.onSurfaceVariant, fontFamily: NAV_LABEL_FONT, fontSize: NAV_LABEL_SIZE },
            selected: { color: m3.onSurface },
        }),
        [m3]
    );
    const iconColor = useMemo(() => ({ default: m3.onSurfaceVariant, selected: m3.onSecondaryContainer }), [m3]);

    return (
        <NativeTabs
            backBehavior="initialRoute"
            backgroundColor={m3.surfaceContainer}
            badgeBackgroundColor={m3.error}
            badgeTextColor={m3.onError}
            iconColor={iconColor}
            indicatorColor={m3.secondaryContainer}
            labelStyle={labelStyle}
            labelVisibilityMode="labeled"
            rippleColor={withAlpha(m3.onSurface, PRESSED_ALPHA)}
        >
            <NativeTabs.Trigger name="(transactions)">
                <NativeTabs.Trigger.Icon src={{ default: logIcon, selected: logSelectedIcon }} />
                <NativeTabs.Trigger.Label>{t("nav.tab.log")}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="insights">
                <NativeTabs.Trigger.Icon src={{ default: insightsIcon, selected: insightsSelectedIcon }} />
                <NativeTabs.Trigger.Label>{t("nav.tab.insights")}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="budgets">
                <NativeTabs.Trigger.Icon src={{ default: budgetsIcon, selected: budgetsSelectedIcon }} />
                <NativeTabs.Trigger.Label>{t("nav.tab.budgets")}</NativeTabs.Trigger.Label>

                {overBudget > 0 ? <NativeTabs.Trigger.Badge>{String(overBudget)}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="settings">
                <NativeTabs.Trigger.Icon src={{ default: settingsIcon, selected: settingsSelectedIcon }} />
                <NativeTabs.Trigger.Label>{t("nav.tab.settings")}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
