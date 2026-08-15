import { View } from "react-native";

import { useDisplaySettings } from "@/contexts/display-settings-context";
import { formatDayHeader } from "@/domain/dates";
import type { DaySection } from "@/domain/day-sections";
import { useLanguage, useTranslation } from "@/i18n/context";

import { ActionMenu } from "./action-menu";
import { DayTotal } from "./amount-text";
import { MonoLabel } from "./mono-label";
import { cn } from "./tw";

interface DaySectionHeaderProps {
    /**
     * The top inset is the gap between one day group and the next — the previous
     * group's 18pt trailing padding plus this header's own 10pt. The first group
     * has no predecessor, so it gets only the 10.
     */
    first?: boolean;
    /** Draws the day as a shareable card. Omit on a surface that offers none. */
    onShare?: () => void;
    section: DaySection<unknown>;
}

export function DaySectionHeader({ section, first = false, onShare }: DaySectionHeaderProps) {
    const { showCents } = useDisplaySettings().state;
    // Consuming the language here is what re-renders this header when it changes;
    // `formatDayHeader`'s `runtimeLanguage()` default is invisible to React.
    const { language } = useLanguage();
    const t = useTranslation();
    const body = (
        <>
            <View className="flex-row items-baseline justify-between gap-2">
                <MonoLabel>{formatDayHeader(section.day, undefined, language)}</MonoLabel>
                <DayTotal showCents={showCents} totals={section.totals} />
            </View>
            {/* A 1.3 stroke with round caps, not a 1px border. */}
            <View className="bg-border" style={{ borderRadius: 0.65, height: 1.3 }} />
        </>
    );
    const className = first ? "gap-1.25 pt-2.5" : "gap-1.25 pt-7";

    if (!onShare) {
        return <View className={className}>{body}</View>;
    }

    return (
        <ActionMenu
            items={[
                {
                    icon: "square.and.arrow.up",
                    id: "share",
                    label: t("alerts.dayCard.share"),
                    onPress: onShare,
                },
            ]}
        >
            {/* The menu lifts this view into its preview, so the group's own
			    ground has to be on it — a transparent header would be snapshotted
			    against nothing. */}
            <View className={cn("bg-background", className)}>{body}</View>
        </ActionMenu>
    );
}
