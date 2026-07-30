import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
	CurrencyHint,
	CurrencyRow,
	CurrencySectionHeader,
} from "@/components/currency-picker-row";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	toggleFavouriteCurrency,
	useFavouriteCurrencies,
} from "@/data/favourite-currencies";
import { setCurrency } from "@/data/settings";
import type { Database } from "@/db/client";
import {
	type CurrencyPickerRow,
	currencyPickerRows,
} from "@/domain/currency-picker-rows";
import {
	FAVOURITE_CURRENCY_LIMIT,
	isFavourite,
} from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";

export default function CurrencyPickerScreen() {
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

	const rows = useMemo<readonly CurrencyPickerRow[]>(
		() => currencyPickerRows(favourites, query),
		[favourites, query],
	);

	const onSelect = (code: string) => {
		setCurrency(db, code).then(() => router.back());
	};

	// Read off the list the write produced, not off `favourites.length` at press
	// time: toggles are serialised, so a row rendered a tick before another landed
	// would otherwise mis-read the cap.
	const onToggleFavourite = (code: string, favourite: boolean) => {
		toggleFavouriteCurrency(db, code).then((next) => {
			haptics(!favourite && !isFavourite(next, code) ? "warning" : "light");
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
			<FlatList
				contentInsetAdjustmentBehavior="automatic"
				data={rows}
				keyExtractor={(row) => row.key}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
				renderItem={({ item: row }) => {
					if (row.kind === "header") {
						return <CurrencySectionHeader section={row.section} />;
					}
					if (row.kind === "hint") {
						return <CurrencyHint />;
					}
					return (
						<CurrencyRow
							code={row.code}
							favourite={row.favourite}
							full={favourites.length >= FAVOURITE_CURRENCY_LIMIT}
							onPress={() => onSelect(row.code)}
							onToggleFavourite={() =>
								onToggleFavourite(row.code, row.favourite)
							}
							selected={row.code === selected}
						/>
					);
				}}
			/>
		</View>
	);
}
