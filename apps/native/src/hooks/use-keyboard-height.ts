import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * The on-screen keyboard's height, 0 while it is down. Built on the `Did`
 * events because Android never sends `keyboardWillShow`/`keyboardWillHide`;
 * the Android editors pad their scrollers with it so the last field can
 * scroll clear of the keyboard.
 */
export function useKeyboardHeight(): number {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", (event) => setHeight(event.endCoordinates.height));
        const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return height;
}
