import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { SheetGestureRootProps } from "./sheet-gesture-root";

const FILL = { flex: 1 } as const;

/**
 * A gesture-handler root of the sheet's own, for its Compose window. With
 * neither `fill` nor `style` it takes gesture-handler's default, which is also
 * `flex: 1`; `fill` says so on purpose, and `style` frames it any other way.
 */
export function SheetGestureRoot({ children, fill = false, style }: SheetGestureRootProps) {
    return <GestureHandlerRootView style={fill ? [FILL, style] : style}>{children}</GestureHandlerRootView>;
}
