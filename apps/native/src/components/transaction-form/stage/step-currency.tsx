import { Search01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { useColors } from "@/theme/use-colors";

import { CurrencyPickerList } from "../../currency-picker-list";

export interface StepCurrencyProps {
    /**
     * Codes clustered above the catalogue, in order. The cluster and the search
     * both come from `currencyPickerRows` by way of `CurrencyPickerList`.
     */
    favourites: readonly string[];
    /**
     * Floor for the virtualised list. A stage body has no intrinsic height, and
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
                    style={{
                        color: colors.foreground,
                        flex: 1,
                        fontFamily: "SFProRounded-Regular",
                        fontSize: 16,
                        padding: 0,
                    }}
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
                style={{ minHeight: listMinHeight }}
            />
        </View>
    );
}
