import Search01Icon from "@hugeicons-pro/core-stroke-rounded/Search01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { View } from "react-native";

import { SEARCH_FIELD } from "@/components/search-field-style";
import { TextInput } from "@/components/text";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useColors } from "@/theme/use-colors";

import { CurrencyPickerList } from "../../currency-picker-list";

export interface StepCurrencyProps {
    /**
     * Codes clustered above the catalogue, in order. The cluster and the search
     * both come from `currencyPickerRows` by way of `CurrencyPickerList`.
     */
    favourites: readonly string[];
    /**
     * Sizes the virtualised list. A stage body has no intrinsic height, and
     * an auto-sized list measures to zero for the frames the stage is swapping.
     */
    listMinHeight: number;
    onSelect: (code: string) => void;
    /** `null` while no database is open, so favouriting is absent rather than dead. */
    onToggleFavourite: ((code: string, favourite: boolean) => void) | null;
    searchPlaceholder: string;
    selected: string;
}

/**
 * The currency picker as a stage body. The list is `CurrencyPickerList`, not a
 * fresh one: the SwiftUI `List` it replaced mounted all 165 rows in a single
 * commit, and the virtualisation, the per-keystroke cost and the favourite-travel
 * animation all live there.
 */
export function StepCurrency({
    favourites,
    listMinHeight,
    onSelect,
    onToggleFavourite,
    searchPlaceholder,
    selected,
}: StepCurrencyProps) {
    const colors = useColors();
    const largeText = useAccessibilityTextSize();
    const [query, setQuery] = useState("");

    return (
        <View className="gap-1">
            <View className="border-border flex-row items-center gap-2 border-b pb-2">
                <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={16} strokeWidth={2} />
                <TextInput
                    accessibilityLabel={searchPlaceholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onChangeText={setQuery}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={[SEARCH_FIELD, { color: colors.foreground }]}
                    value={query}
                />
            </View>

            <CurrencyPickerList
                contentContainerStyle={{ paddingBottom: 8 }}
                favourites={favourites}
                onSelect={onSelect}
                onToggleFavourite={onToggleFavourite}
                query={query}
                selected={selected}
                style={largeText ? { height: listMinHeight } : { minHeight: listMinHeight }}
            />
        </View>
    );
}
