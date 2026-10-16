import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface SheetGestureRootProps {
    children: ReactNode;
    /** The sheet has a fixed height (snap points) that its content fills. */
    fill?: boolean;
    /** The root's frame on Android, applied after `fill`. */
    style?: StyleProp<ViewStyle>;
}

/**
 * The gesture-handler root a community bottom sheet's content needs. Nothing on
 * iOS, where the sheet is part of the app's own view tree. On Android it is a
 * Compose `ModalBottomSheet` in a window of its own, outside the app's root, so
 * swipes, long presses and drags inside it never activate without a root of
 * their own (`sheet-gesture-root.android.tsx`).
 */
export function SheetGestureRoot({ children }: SheetGestureRootProps) {
    return children;
}
