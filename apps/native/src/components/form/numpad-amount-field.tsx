import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { type ComponentProps, type RefObject, useRef } from "react";
import { numpadToNumber } from "@/domain/numpad";
import type { AmountEntrySheet } from "../amount-entry-sheet";

type AmountEntrySheetProps = ComponentProps<typeof AmountEntrySheet>;

export interface NumpadAmountField {
	readonly amount: number;
	readonly present: () => void;
	readonly sheetProps: Omit<AmountEntrySheetProps, "ref"> & {
		ref: RefObject<BottomSheetModal | null>;
	};
}

interface UseNumpadAmountFieldOptions {
	value: string;
	onChange: (next: string) => void;
	code: string;
	minorUnits: number;
	toneClass?: string;
	onCurrencyChange?: (code: string) => void;
}

export function useNumpadAmountField({
	value,
	onChange,
	code,
	minorUnits,
	toneClass,
	onCurrencyChange,
}: UseNumpadAmountFieldOptions): NumpadAmountField {
	const ref = useRef<BottomSheetModal>(null);
	return {
		amount: numpadToNumber(value),
		present: () => ref.current?.present(),
		sheetProps: {
			code,
			minorUnits,
			onChange,
			onCurrencyChange,
			onDone: () => ref.current?.dismiss(),
			ref,
			toneClass,
			value,
		},
	};
}
