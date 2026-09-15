import { BottomSheetModal, BottomSheetTextInput } from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import type { Ref } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalData } from "@/contexts/local-data-context";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
import { useToggleFavouriteCurrency } from "@/hooks/use-toggle-favourite-currency";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { CurrencyPickerList } from "./currency-picker-list";
import { Text } from "./text";

interface CurrencyPickerSheetProps {
    onSelect: (code: string) => void;
    ref?: Ref<BottomSheetModal>;
    selected: string;
}

const SHORT_DETENT = 0.55;
/** `@expo/ui` pads the sheet's content box out from the drag indicator. */
const SHEET_TOP_PADDING = 16;
/** The gap iOS leaves above a sheet's card. */
const SHEET_CARD_GAP = 10;
const TITLE_HEIGHT = 48;
const SEARCH_HEIGHT = 52;

/** Present via the forwarded ref: `ref.current?.present()`. */
export function CurrencyPickerSheet({ selected, onSelect, ref }: CurrencyPickerSheetProps) {
    const colors = useColors();
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    // The shorter detent, less the chrome above the list. A fraction detent is a
    // fraction of the sheet's own height rather than the window's — 768 of 874pt
    // on an iPhone 17 Pro, and less again where this sheet opens over another one
    // — so the subtraction has to err under: too tall hangs the list past the
    // short detent, too short only shows the sheet's own background for a frame.
    const listFloor =
        (height - insets.top - insets.bottom - SHEET_CARD_GAP) * SHORT_DETENT -
        SHEET_TOP_PADDING -
        TITLE_HEIGHT -
        SEARCH_HEIGHT;
    const [query, setQuery] = useState("");
    const t = useTranslation();
    // The nullable `db` from the context, not `useDatabase()`: the sheet is mounted
    // by forms whose own callers can sit above the root splash gate, where
    // `useDatabase()` throws.
    const { db } = useLocalData();
    const favourites = useFavouriteCurrencies(db);

    const onToggleFavourite = useToggleFavouriteCurrency(db);

    return (
        <BottomSheetModal
            // Solid, not the default translucent material: the rows are opaque (see
            // `currency-picker-list`) and no solid colour can match a blur.
            backgroundStyle={{ backgroundColor: colors.background }}
            enableDynamicSizing={false}
            enablePanDownToClose
            ref={ref}
            snapPoints={[`${SHORT_DETENT * 100}%`, "100%"]}
        >
            <View className="bg-background flex-1">
                {/* Explicit heights, so what the floor above subtracts is what the chrome
				    is — and so both survive the frames where their own contents measure
				    to zero. */}
                <View className="items-center justify-center px-5" style={{ height: TITLE_HEIGHT }}>
                    <Text className="font-sans-semibold text-foreground text-headline">
                        {t("onboarding.currency.picker.title")}
                    </Text>
                </View>

                <View className="px-5 pb-2" style={{ height: SEARCH_HEIGHT }}>
                    <View className="bg-surface flex-1 flex-row items-center gap-2 rounded-full px-4">
                        <SymbolView
                            name="magnifyingglass"
                            size={16}
                            tintColor={colors.muted}
                            type="monochrome"
                            weight="semibold"
                        />
                        <BottomSheetTextInput
                            autoCapitalize="characters"
                            autoCorrect={false}
                            onChangeText={setQuery}
                            placeholder={t("onboarding.currency.picker.searchPlaceholder")}
                            placeholderTextColor={colors.muted}
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
                </View>

                <CurrencyPickerList
                    contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}
                    favourites={favourites}
                    onSelect={onSelect}
                    onToggleFavourite={db === null ? null : onToggleFavourite}
                    query={query}
                    selected={selected}
                    // The sheet lays its content into a `{flexGrow:1, height:0}` box, so
                    // while it animates in every auto-sized child measures to zero and it
                    // presents blank. A floor gives the list a size from the first frame;
                    // flex still takes over at the taller detent.
                    style={{ minHeight: listFloor }}
                />
            </View>
        </BottomSheetModal>
    );
}
