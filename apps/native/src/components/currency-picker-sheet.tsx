import {
	BottomSheetFlatList,
	BottomSheetModal,
	BottomSheetTextInput,
} from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { forwardRef, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalData } from "@/contexts/local-data-context";
import {
	toggleFavouriteCurrency,
	useFavouriteCurrencies,
} from "@/data/favourite-currencies";
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
import { useColors } from "@/theme/use-colors";
import {
	CurrencyHint,
	CurrencyRow,
	CurrencySectionHeader,
} from "./currency-picker-row";
import { Text } from "./text";

interface CurrencyPickerSheetProps {
	selected: string;
	onSelect: (code: string) => void;
}

/** Present via the forwarded ref: `ref.current?.present()`. */
export const CurrencyPickerSheet = forwardRef<
	BottomSheetModal,
	CurrencyPickerSheetProps
>(function CurrencyPickerSheet({ selected, onSelect }, ref) {
	const colors = useColors();
	const [query, setQuery] = useState("");
	const t = useTranslation();
	const haptics = useHaptics();
	// The nullable `db` from the context, not `useDatabase()`: the sheet is mounted
	// by forms whose own callers can sit above the root splash gate, where
	// `useDatabase()` throws.
	const { db } = useLocalData();
	const favourites = useFavouriteCurrencies(db);

	const rows = useMemo<readonly CurrencyPickerRow[]>(
		() => currencyPickerRows(favourites, query),
		[favourites, query],
	);

	// Read off the list the write produced, not off `favourites.length` at press
	// time: toggles are serialised, so a row rendered a tick before another landed
	// would otherwise mis-read the cap.
	const onToggleFavourite = (code: string, favourite: boolean) => {
		if (db === null) {
			return;
		}
		toggleFavouriteCurrency(db, code).then((next) => {
			haptics(!favourite && !isFavourite(next, code) ? "warning" : "light");
		});
	};

	return (
		<BottomSheetModal
			ref={ref}
			snapPoints={["55%", "100%"]}
			enableDynamicSizing={false}
			enablePanDownToClose
			// Reaches SwiftUI's `.presentationBackground(_:)`. Solid rather than the
			// default translucent material: the rows must be opaque (see
			// `currency-picker-row`) and no solid colour can match a blur.
			backgroundStyle={{ backgroundColor: colors.background }}
		>
			<View className="flex-1 bg-background">
				<View className="items-center px-5 pt-3 pb-3">
					<Text className="font-sans-semibold text-foreground text-headline">
						{t("onboarding.currency.picker.title")}
					</Text>
				</View>

				<View className="px-5 pb-2">
					<View className="flex-row items-center gap-2 rounded-full bg-surface px-4 py-3">
						<SymbolView
							name="magnifyingglass"
							size={16}
							weight="semibold"
							tintColor={colors.muted}
							type="monochrome"
						/>
						<BottomSheetTextInput
							value={query}
							onChangeText={setQuery}
							placeholder={t("onboarding.currency.picker.searchPlaceholder")}
							placeholderTextColor={colors.muted}
							autoCapitalize="characters"
							autoCorrect={false}
							style={{
								flex: 1,
								fontFamily: "SFProRounded-Regular",
								fontSize: 16,
								color: colors.foreground,
								padding: 0,
							}}
						/>
					</View>
				</View>

				<BottomSheetFlatList
					data={rows}
					keyExtractor={(row: CurrencyPickerRow) => row.key}
					contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
					keyboardShouldPersistTaps="handled"
					renderItem={({ item: row }: { item: CurrencyPickerRow }) => {
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
								onToggleFavourite={
									db === null
										? null
										: () => onToggleFavourite(row.code, row.favourite)
								}
								selected={row.code === selected}
							/>
						);
					}}
				/>
			</View>
		</BottomSheetModal>
	);
});
