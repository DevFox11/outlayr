import { DatePicker, Host, HStack, Spacer } from "@expo/ui/swift-ui";
import { datePickerStyle, frame, labelsHidden } from "@expo/ui/swift-ui/modifiers";

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
    return (
        <Host style={{ height }}>
            <HStack modifiers={[frame({ maxHeight: Number.POSITIVE_INFINITY })]}>
                <DatePicker
                    displayedComponents={["date"]}
                    modifiers={[datePickerStyle("compact"), labelsHidden()]}
                    onDateChange={onChange}
                    range={range}
                    selection={value}
                />
                <Spacer />
            </HStack>
        </Host>
    );
}
