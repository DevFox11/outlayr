import { Stack } from "expo-router";

import type { InsightsPeriod } from "@/data/insights";
import { useTranslation } from "@/i18n/context";

import { PERIODS } from "../periods";

export interface InsightsPeriodMenuProps {
    period: InsightsPeriod;
    /** Takes the stored setting value, as `PERIODS` lists it. */
    onSelect: (value: number) => void;
}

/** The week / month / year switch, a menu on the right of the bar labelled with the current period. */
export function InsightsPeriodMenu({ period, onSelect }: InsightsPeriodMenuProps) {
    const t = useTranslation();
    return (
        <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu accessibilityLabel={t("insights.period.change")}>
                <Stack.Toolbar.Label>
                    {t(PERIODS.find((option) => option.period === period)?.labelKey ?? "insights.period.week")}
                </Stack.Toolbar.Label>
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
