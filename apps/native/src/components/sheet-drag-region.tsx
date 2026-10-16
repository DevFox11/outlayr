import type { ReactNode } from "react";

/**
 * A region of a bottom sheet whose drags belong to its content, not to the
 * sheet. iOS needs nothing: the sheet's own pan yields to a gesture-handler pan
 * inside it. `sheet-drag-region.android.tsx` makes the Compose sheet yield.
 */
export function SheetDragRegion({ children }: { children: ReactNode }) {
    return children;
}
