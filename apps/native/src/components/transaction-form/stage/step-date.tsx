import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";

/**
 * A three-column wheel's own height. The `Host` is a fixed box rather than
 * `matchContents`: a SwiftUI wheel reports no intrinsic height through the
 * bridge, and an unsized host collapses it to nothing.
 *
 * Shorter than the keypad it swaps with, so no step of the stage is the one
 * that pushes the sentence off the screen.
 */
const WHEEL_HEIGHT = 196;

interface StepDateProps {
    date: Date;
    onChange: (next: Date) => void;
    /** Adds the clock. A schedule's end date is a day, not a moment. */
    withTime?: boolean;
}

/**
 * The stage's date step — the picker the other steps delegate their calendar
 * to. `compact` is the style every other date row in the app uses and is not
 * usable here: it is a button that opens a popover of its own, which is exactly
 * the presentation the stage exists to remove.
 */
export function StepDate({ date, onChange, withTime = false }: StepDateProps) {
    return (
        <Host style={{ height: WHEEL_HEIGHT }}>
            <DatePicker
                displayedComponents={withTime ? ["date", "hourAndMinute"] : ["date"]}
                modifiers={[datePickerStyle("wheel"), labelsHidden()]}
                onDateChange={onChange}
                selection={date}
            />
        </Host>
    );
}
