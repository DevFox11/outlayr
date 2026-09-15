import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { CurrencyPickerList } from "@/components/currency-picker-list";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
import { toggleFavouriteCurrency } from "@/data/favourite-currencies-core";
import { setCurrency } from "@/data/settings-core";
import { isFavourite } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

export function Currency() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const selected = useGlobalCurrency(db);
    const favourites = useFavouriteCurrencies(db);
    const [query, setQuery] = useState("");

    const onSelect = (code: string) => {
        setCurrency(db, code).then(() => router.back());
    };

    // Read off the list the write produced, not off `favourites.length` at press
    // time: toggles are serialised, so a row rendered a tick before another landed
    // would otherwise mis-read the cap.
    const onToggleFavourite = (code: string, favourite: boolean) => {
        toggleFavouriteCurrency(db, code).then((next) => {
            // oxlint-disable-next-line promise/no-callback-in-promise -- a press handler is not a promise chain, so the haptic has nowhere else to be sequenced from
            haptics(favourite || isFavourite(next, code) ? "light" : "warning");
        });
    };

    return (
        <View className="bg-background flex-1">
            <Stack.SearchBar
                autoCapitalize="characters"
                hideWhenScrolling={false}
                onChangeText={(event) => setQuery(event.nativeEvent.text)}
                placeholder={t("settings.currency.search")}
            />
            <CurrencyPickerList
                contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
                favourites={favourites}
                onSelect={onSelect}
                onToggleFavourite={onToggleFavourite}
                query={query}
                selected={selected}
            />
        </View>
    );
}
