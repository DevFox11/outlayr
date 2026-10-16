import type { ReactNode } from "react";

/**
 * Keeps an inline editor's field above the keyboard, around the scroller that
 * holds it. iOS needs nothing here: the scroller insets itself through
 * `automaticallyAdjustKeyboardInsets`. `inline-editor-keyboard.android.tsx`
 * does the work Android's edge-to-edge window no longer does by resizing.
 */
export function InlineEditorKeyboard({ children }: { children: ReactNode }) {
    return children;
}
