import { View } from "react-native";

import type { RestingSheetFrameProps } from "./resting-sheet-frame";

/** The fit-to-contents sheet takes this view's height as its own. */
export function RestingSheetFrame({ height, children }: RestingSheetFrameProps) {
    return <View style={{ height }}>{children}</View>;
}
