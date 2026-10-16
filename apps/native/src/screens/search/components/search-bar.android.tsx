import { Stack } from "expo-router";

import { useMaterialColors } from "@/theme/use-material-colors";

import type { SearchBar as SearchBarBase } from "./search-bar";

export type { SearchBarProps } from "./search-bar";

/**
 * The header field as Material's search view: the input sits flat on the app
 * bar in on-surface, with the hint and the clear X in on-surface-variant. On
 * Android `barTintColor` paints the field's plate, which drops the platform's
 * underline (`tintColor` does nothing there); the hint's own magnifier goes
 * too, since the bar already leads with a back arrow.
 */
export const SearchBar: typeof SearchBarBase = ({ onChangeText, onClose, placeholder }) => {
    const m3 = useMaterialColors();
    return (
        <Stack.SearchBar
            autoFocus
            barTintColor={m3.surface}
            headerIconColor={m3.onSurfaceVariant}
            hideWhenScrolling={false}
            hintTextColor={m3.onSurfaceVariant}
            onChangeText={(event) => onChangeText(event.nativeEvent.text)}
            onClose={onClose}
            placeholder={placeholder}
            shouldShowHintSearchIcon={false}
            textColor={m3.onSurface}
        />
    );
};
