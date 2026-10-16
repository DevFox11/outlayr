import type { IconSvgElement } from "@hugeicons/react-native";
import type { ReactNode } from "react";

export interface SheetHeaderProps {
    /** Start-aligned after the close button. Omit for an untitled sheet. */
    title?: string;
    /** What the close (X) button does. Defaults to `router.back()`, which a discard guard still sees. */
    onClose?: () => void;
    /** The trailing actions: `SheetHeaderTextButton` and `SheetHeaderIconButton`, in reading order. */
    children?: ReactNode;
}

export interface SheetHeaderTextButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}

export interface SheetHeaderIconButtonProps {
    icon: IconSvgElement;
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
    /** Draws the glyph in the error colour, for Delete. */
    destructive?: boolean;
}

/**
 * The header a form sheet draws inside itself: drag handle, close, title and
 * trailing actions.
 *
 * Android only. react-native-screens never builds an app bar for a form sheet
 * there, so the title, close button and `Stack.Toolbar` items a sheet declares
 * all vanish; `sheet-header.android.tsx` draws them in the sheet instead. iOS
 * keeps its native bar and toolbar, so this renders nothing and a sheet can
 * carry both side by side.
 */
export function SheetHeader(_props: SheetHeaderProps) {
    return null;
}

/** A trailing text action, such as Save. Renders only inside an Android `SheetHeader`. */
export function SheetHeaderTextButton(_props: SheetHeaderTextButtonProps) {
    return null;
}

/** A trailing icon action, such as Delete. Renders only inside an Android `SheetHeader`. */
export function SheetHeaderIconButton(_props: SheetHeaderIconButtonProps) {
    return null;
}
