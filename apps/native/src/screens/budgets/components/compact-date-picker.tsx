import { DatePicker, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import { datePickerStyle, environment, frame, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import { useMemo } from "react";

import { useRegionCode } from "@/hooks/use-region-code";
import { useLanguage } from "@/i18n/context";

export interface CompactDatePickerProps {
    /** iOS: the host's height. */
    height?: number;
    /** What the date is, for TalkBack. iOS's compact field reads its own value. */
    label: string;
    /** A day was picked. */
    onChange: (next: Date) => void;
    /** Android: the dialog closed without a pick. */
    onDismiss?: () => void;
    /** The days on offer, inclusive. Either end may be open. */
    range: { end?: Date; start?: Date };
    value: Date;
}

/**
 * One day, picked in place: SwiftUI's compact date field, which opens its own
 * calendar popover. `compact-date-picker.android.tsx` is a field that opens the
 * Material date dialog instead, since this view does not exist on Android.
 */
export function CompactDatePicker({ height = 40, onChange, range, value }: CompactDatePickerProps) {
    const locale = useDatePickerLocale();
    return (
        <Host style={{ height }}>
            <HStack modifiers={[frame({ maxHeight: Number.POSITIVE_INFINITY })]}>
                <DatePicker
                    displayedComponents={["date"]}
                    modifiers={[datePickerStyle("compact"), labelsHidden(), locale]}
                    onDateChange={onChange}
                    range={range}
                    selection={value}
                />
                <Spacer />
            </HStack>
        </Host>
    );
}

/**
 * The locale a SwiftUI date field writes its date in: the app's language in the
 * device's region. The field reads the system's otherwise, which stays Spanish
 * in an app set to English on a Spanish device.
 */
export function useDatePickerLocale() {
    const { language } = useLanguage();
    const region = useRegionCode();
    // @expo/ui drops an id missing from `Locale.availableIdentifiers`, which has no `en_VE`. Hermes resolves
    // against that list, so `en-VE` comes back as `en` and `en-GB` as itself.
    const id = useMemo(
        () => new Intl.DateTimeFormat(region ? `${language}-${region}` : language).resolvedOptions().locale,
        [language, region]
    );
    return environment({ key: "locale", value: id.replace("-", "_") });
}
