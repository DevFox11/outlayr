import NativeSegmentedControl from "@expo/ui/community/segmented-control";
import type { NativeSegmentedControlChangeEvent } from "@expo/ui/community/segmented-control";

type SegmentedValue = string | number | boolean;

interface SegmentedOption<T extends SegmentedValue> {
    label: string;
    value: T;
}

interface SegmentedControlProps<T extends SegmentedValue> {
    onChange: (value: T) => void;
    options: readonly SegmentedOption<T>[];
    value: T;
}

/** The native control speaks in segment indices; callers get typed values back. */
export function SegmentedControl<T extends SegmentedValue>({ options, value, onChange }: SegmentedControlProps<T>) {
    const selectedIndex = options.findIndex((option) => option.value === value);
    return (
        <NativeSegmentedControl
            onChange={(event: NativeSegmentedControlChangeEvent) => {
                const picked = options[event.nativeEvent.selectedSegmentIndex];
                if (picked) {
                    onChange(picked.value);
                }
            }}
            selectedIndex={Math.max(0, selectedIndex)}
            values={options.map((option) => option.label)}
        />
    );
}
