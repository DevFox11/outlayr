import { Stack } from "expo-router";

export interface SearchBarProps {
    onChangeText: (text: string) => void;
    /** Leaves the search screen. */
    onClose: () => void;
    placeholder: string;
}

/** The search screen's header field. `search-bar.android.tsx` colours it for Material. */
export function SearchBar({ onChangeText, onClose, placeholder }: SearchBarProps) {
    return (
        <Stack.SearchBar
            autoFocus
            hideWhenScrolling={false}
            // The field's Cancel closes the whole task, not just the field. Android
            // has no Cancel: backing out of the field there closes it instead.
            onCancelButtonPress={onClose}
            onClose={onClose}
            onChangeText={(event) => onChangeText(event.nativeEvent.text)}
            placeholder={placeholder}
        />
    );
}
