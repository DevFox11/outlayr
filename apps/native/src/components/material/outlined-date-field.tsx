import { DatePickerDialog } from "@expo/ui/jetpack-compose";
import { useState } from "react";
import type { ReactNode } from "react";
import { Keyboard } from "react-native";

import { MaterialHost } from "@/components/material-host";
import { Text } from "@/components/text";
import { formatTargetDate } from "@/domain/dates";
import { useLanguage } from "@/i18n/context";

import { OutlinedSelectField } from "./outlined-field";

/**
 * Material 3's date dialog and the outlined field that opens it, for the
 * Android editors. It draws Compose, so import it only from `.android.tsx` files.
 */

interface DateDialogProps {
    /** A day was picked, at `value`'s time of day. */
    onChange: (next: Date) => void;
    onDismiss: () => void;
    /** The days on offer, inclusive. Either end may be open. */
    range: { end?: Date; start?: Date };
    value: Date;
}

/** UTC midnight of `date`'s local day: Material 3's picker counts in UTC days. */
function utcDay(date: Date): string {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}

/** The UTC day the picker reports, as that same local day at `date`'s time of day. */
function localDay(picked: Date, date: Date): Date {
    const next = new Date(date);
    next.setFullYear(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate());
    return next;
}

/**
 * The Material date dialog, up for as long as it is mounted: mount it only
 * while open. It sits in `MaterialHost` so it wears the app's scheme, not the
 * handset's.
 */
export function DateDialog({ onChange, onDismiss, range, value }: DateDialogProps) {
    return (
        <MaterialHost>
            <DatePickerDialog
                initialDate={utcDay(value)}
                onDateSelected={(picked) => onChange(localDay(picked, value))}
                onDismissRequest={onDismiss}
                selectableDates={range}
            />
        </MaterialHost>
    );
}

interface OutlinedDateFieldProps extends Omit<DateDialogProps, "onDismiss"> {
    label: string;
    /** The dialog closed without a pick. */
    onDismiss?: () => void;
    ground?: string;
    /** A control at the end of the field, such as clearing an optional day. */
    trailing?: ReactNode;
}

/**
 * One day as a read-only outlined field that opens the date dialog. The field
 * stays as it is while the dialog is up, and the dialog closes on a pick or a
 * dismiss.
 */
export function OutlinedDateField({
    label,
    onChange,
    onDismiss,
    range,
    value,
    ground,
    trailing,
}: OutlinedDateFieldProps) {
    const { language } = useLanguage();
    const [open, setOpen] = useState(false);
    const shown = formatTargetDate(value, language);
    return (
        <>
            <OutlinedSelectField
                accessibilityValue={shown}
                dropdown={false}
                ground={ground}
                label={label}
                onPress={() => {
                    Keyboard.dismiss();
                    setOpen(true);
                }}
                trailing={trailing}
                value={
                    <Text className="text-body text-m3-on-surface tabular-nums" numberOfLines={1}>
                        {shown}
                    </Text>
                }
            />
            {open ? (
                <DateDialog
                    onChange={(next) => {
                        setOpen(false);
                        onChange(next);
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
