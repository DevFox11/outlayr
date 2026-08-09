import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { CurrencyPickerList } from "@/components/currency-picker-list";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
import { toggleFavouriteCurrency } from "@/data/favourite-currencies-core";
import { setCurrency } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { isFavourite } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

export function Currency() {
	const db = useDatabase();
	return <CurrencyPicker db={db} />;
}

function CurrencyPicker({ db }: { db: Database }) {
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
			haptics(favourite || isFavourite(next, code) ? "light" : "warning");
		});
	};

	return (
		<View className="flex-1 bg-background">
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
