import { Pressable } from "react-native";

import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { RowPressable as RowPressableBase } from "./row-pressable";

export type { RowPressableProps } from "./row-pressable";

/** Material's pressed state layer: on-surface at 10%. */
const PRESSED_ALPHA = 0.1;

/** A list row's press target on Android: a ripple in the scheme's on-surface. */
export const RowPressable: typeof RowPressableBase = (props) => {
    const m3 = useMaterialColors();
    return <Pressable android_ripple={{ color: withAlpha(m3.onSurface, PRESSED_ALPHA) }} {...props} />;
};
