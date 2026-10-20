import Calendar03Icon from "@hugeicons-pro/core-stroke-rounded/Calendar03Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { DateDialog } from "@/components/material/outlined-date-field";
import { Text } from "@/components/text";
import { formatTargetDate } from "@/domain/dates";
import { useLanguage } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { CompactDatePickerProps } from "./compact-date-picker";

export type { CompactDatePickerProps } from "./compact-date-picker";

/**
 * The day as a read-only outlined field that opens the Material date dialog.
 *
 * Every caller mounts this on the tap that asked for a date, so the dialog
 * opens with it; the field stays to reopen it. The dialog closes on a pick or
 * a dismiss. Material editors use `OutlinedDateField` instead.
 */
export function CompactDatePicker({ label, onChange, onDismiss, range, value }: CompactDatePickerProps) {
    const m3 = useMaterialColors();
    const { language } = useLanguage();
    const [open, setOpen] = useState(true);
    const shown = formatTargetDate(value, language);

    return (
        <>
            <Pressable
                accessibilityLabel={`${label}, ${shown}`}
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(m3.onSurface, 0.1) }}
                className="border-m3-outline h-14 flex-row items-center justify-between overflow-hidden rounded-[4px] border pr-3 pl-4"
                onPress={() => setOpen(true)}
            >
                <Text className="text-body text-m3-on-surface">{shown}</Text>
                <HugeiconsIcon color={m3.onSurfaceVariant} icon={Calendar03Icon} size={24} strokeWidth={1.6} />
            </Pressable>
            {open ? (
                <DateDialog
                    onChange={(picked) => {
                        setOpen(false);
                        onChange(picked);
                    }}
                    onDismiss={() => {
                        setOpen(false);
                        onDismiss?.();
                    }}
                    range={range}
                    value={value}
                />
            ) : null}
        </>
    );
}
