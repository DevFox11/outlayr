import { type RefObject, useRef } from "react";
import type { Category } from "@/data/categories";
import type { CategoryPickerSheetRef } from "../category-picker-sheet";

export interface CategoryPickerField {
	readonly present: () => void;
	readonly ref: RefObject<CategoryPickerSheetRef | null>;
	readonly select: (picked: Category) => void;
}

export function useCategoryPickerField(onSelect: (picked: Category) => void): CategoryPickerField {
	const ref = useRef<CategoryPickerSheetRef>(null);
	return {
		present: () => ref.current?.present(),
		ref,
		select: (picked) => {
			onSelect(picked);
			ref.current?.dismiss();
		},
	};
}
