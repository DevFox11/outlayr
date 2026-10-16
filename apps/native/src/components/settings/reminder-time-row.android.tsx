import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable } from "react-native";

import { RowShell } from "@/components/list/row-shell";
import type { ReminderTimeRowProps } from "@/components/settings/reminder-time-row";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { formatTimeOfDay } from "@/domain/reminder";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

export type { ReminderTimeRowProps } from "@/components/settings/reminder-time-row";

/**
 * The custom reminder time as a row that opens the Material time dialog.
 *
 * Android's picker is a dialog that stays up for as long as it is mounted, so
 * it mounts only while open and unmounts on a pick or a dismiss. Mounted with
 * the row, it would trap the screen behind a dialog that never closes.
 */
export function ReminderTimeRow({ onChange, value }: ReminderTimeRowProps) {
    const colors = useColors();
    const t = useTranslation();
    const { language } = useLanguage();
    const { use24Hour } = useDisplaySettings().state;
    const [open, setOpen] = useState(false);

    const pickerValue = new Date();
    pickerValue.setHours(value.hour, value.minute, 0, 0);

    return (
        <>
            <Pressable accessibilityRole="button" className="active:opacity-60" onPress={() => setOpen(true)}>
                <RowShell title={t("settings.notifications.time")}>
                    <Text className="text-body text-muted">{formatTimeOfDay(value, use24Hour, language)}</Text>
                </RowShell>
            </Pressable>
            {open ? (
                <DateTimePicker
                    accentColor={colors.tint}
                    is24Hour={use24Hour}
                    mode="time"
                    onDismiss={() => setOpen(false)}
                    onValueChange={(_event, date) => {
                        setOpen(false);
                        onChange({
                            hour: date.getHours(),
                            minute: date.getMinutes(),
                        });
                    }}
                    presentation="dialog"
                    value={pickerValue}
                />
            ) : null}
        </>
    );
}
