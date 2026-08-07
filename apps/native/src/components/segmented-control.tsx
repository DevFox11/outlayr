import NativeSegmentedControl, {
	type NativeSegmentedControlChangeEvent,
} from "@expo/ui/community/segmented-control";

type SegmentedValue = string | number | boolean;

interface SegmentedOption<T extends SegmentedValue> {
	label: string;
	value: T;
}

interface SegmentedControlProps<T extends SegmentedValue> {
	options: readonly SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
}

/** The native control speaks in segment indices; callers get typed values back. */
export function SegmentedControl<T extends SegmentedValue>({
	options,
	value,
	onChange,
}: SegmentedControlProps<T>) {
	const selectedIndex = options.findIndex((option) => option.value === value);
	return (
		<NativeSegmentedControl
			values={options.map((option) => option.label)}
			selectedIndex={selectedIndex < 0 ? 0 : selectedIndex}
			onChange={(event: NativeSegmentedControlChangeEvent) => {
				const picked = options[event.nativeEvent.selectedSegmentIndex];
				if (picked) {
					onChange(picked.value);
				}
			}}
		/>
	);
}
