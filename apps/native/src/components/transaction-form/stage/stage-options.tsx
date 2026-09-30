import type { ReactNode } from "react";
import { View } from "react-native";

import { StageOption } from "./stage-option";

export interface StageOptionItem<Id extends string> {
    /** Defaults to the visible label; give one where the label alone is ambiguous. */
    accessibilityLabel?: string;
    id: Id;
    label: string;
    /** A dot or tile drawn before the label — a category swatch, an account glyph. */
    leading?: ReactNode;
    trailing?: ReactNode;
}

interface StageOptionRowProps<Id extends string> {
    onSelect: (id: Id) => void;
    options: readonly StageOptionItem<Id>[];
    /** Null where the step has no answer yet. */
    selectedId?: Id | null;
}

/**
 * The stage's options, wrapping onto as many lines as they need. Generic over
 * the option id so `onSelect` hands back the caller's own union rather than a
 * bare string.
 */
export function StageOptionRow<Id extends string>({ onSelect, options, selectedId }: StageOptionRowProps<Id>) {
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map((option) => (
                <StageOption
                    accessibilityLabel={option.accessibilityLabel}
                    key={option.id}
                    label={option.label}
                    leading={option.leading}
                    onPress={() => onSelect(option.id)}
                    selected={option.id === selectedId}
                    trailing={option.trailing}
                />
            ))}
        </View>
    );
}
