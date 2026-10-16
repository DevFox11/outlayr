import { Pressable } from "react-native";

import { Text } from "@/components/text";

export interface SheetCommitButtonProps {
    label: string;
    onPress: () => void;
}

/**
 * The button a budget sheet commits with: the limit sheet's "Keep it under…",
 * the goal sheet's "Set goal". Never inert, so a blank figure is answered by
 * the press itself. `sheet-commit-button.android.tsx` is the M3 filled button.
 */
export function SheetCommitButton({ label, onPress }: SheetCommitButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            className="bg-tint h-12 items-center justify-center rounded-[14px] active:opacity-80"
            onPress={onPress}
        >
            <Text className="font-sans-semibold text-accent-foreground text-body">{label}</Text>
        </Pressable>
    );
}
