import { useCallback, useMemo, useRef } from "react";
import type { RefObject } from "react";

import type { Category } from "@/data/categories-core";

import type { CategoryPickerSheetRef } from "../category-picker-sheet";

export interface CategoryPickerField {
    readonly present: () => void;
    readonly ref: RefObject<CategoryPickerSheetRef | null>;
    readonly select: (picked: Category) => void;
}

/**
 * The handlers are stable and the field object with them, so a caller can depend
 * on the whole field rather than reaching into it for one member — which is what
 * the two forms using this were doing, and what the compiler could not follow.
 */
export function useCategoryPickerField(onSelect: (picked: Category) => void): CategoryPickerField {
    const ref = useRef<CategoryPickerSheetRef>(null);
    const present = useCallback(() => ref.current?.present(), []);
    const select = useCallback(
        (picked: Category) => {
            onSelect(picked);
            ref.current?.dismiss();
        },
        [onSelect]
    );
    return useMemo(() => ({ present, ref, select }), [present, select]);
}
