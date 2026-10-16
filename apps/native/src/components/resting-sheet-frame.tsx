import type { ReactNode } from "react";

export interface RestingSheetFrameProps {
    /** `useRestingSheet().height`: what the sheet should be tall right now. */
    height: number | undefined;
    children: ReactNode;
}

/**
 * Sizes a resting entry sheet's content. Nothing on iOS, where the detents move
 * the sheet; on Android the sheet fits its content, so this frame's height is
 * what raises and lowers it (`resting-sheet-frame.android.tsx`).
 */
export function RestingSheetFrame({ children }: RestingSheetFrameProps) {
    return children;
}
