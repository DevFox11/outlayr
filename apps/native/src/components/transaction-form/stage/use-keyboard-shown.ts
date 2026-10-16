import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Whether the software keyboard is up. The stage hides its footer button under
 * it, and the CTA moves Save into the bar while it is.
 *
 * The `Will` events, so both move with the keyboard rather than after it. iOS
 * only: Android never sends them (see `use-keyboard-shown.android.ts`).
 */
export function useKeyboardShown(): boolean {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener("keyboardWillShow", () => setShown(true));
        const hide = Keyboard.addListener("keyboardWillHide", () => setShown(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return shown;
}
