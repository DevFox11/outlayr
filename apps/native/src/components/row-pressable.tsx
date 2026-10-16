import { Pressable } from "react-native";
import type { PressableProps } from "react-native";

import { cn } from "./tw";

export type RowPressableProps = PressableProps & { className?: string };

/**
 * The press target of a list row or figure cell. It dims while held on iOS;
 * `row-pressable.android.tsx` ripples instead, as Material rows do.
 */
export function RowPressable({ className, ...props }: RowPressableProps) {
    return <Pressable className={cn(className, "active:opacity-70")} {...props} />;
}
