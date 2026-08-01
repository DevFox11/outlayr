import {
	BottomSheetModal,
	BottomSheetTextInput,
} from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { forwardRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalData } from "@/contexts/local-data-context";
import {
	toggleFavouriteCurrency,
	useFavouriteCurrencies,
} from "@/data/favourite-currencies";
import { isFavourite } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";
import { CurrencyPickerList } from "./currency-picker-list";
import { Text } from "./text";

interface CurrencyPickerSheetProps {
	selected: string;
	onSelect: (code: string) => void;
}

const SHORT_DETENT = 0.55;
/** `@expo/ui` pads the sheet's content box out from the drag indicator. */
const SHEET_TOP_PADDING = 16;
/** The gap iOS leaves above a sheet's card. */
const SHEET_CARD_GAP = 10;
const TITLE_HEIGHT = 48;
const SEARCH_HEIGHT = 52;

/** Present via the forwarded ref: `ref.current?.present()`. */
export const CurrencyPickerSheet = forwardRef<
	BottomSheetModal,
	CurrencyPickerSheetProps
>(function CurrencyPickerSheet({ selected, onSelect }, ref) {
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
	const haptics = useHaptics();
	// The nullable `db` from the context, not `useDatabase()`: the sheet is mounted
	// by forms whose own callers can sit above the root splash gate, where
	// `useDatabase()` throws.
	const { db } = useLocalData();
	const favourites = useFavouriteCurrencies(db);

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
			snapPoints={[`${SHORT_DETENT * 100}%`, "100%"]}
			enableDynamicSizing={false}
			enablePanDownToClose
			// Solid, not the default translucent material: the rows are opaque (see
			// `currency-picker-list`) and no solid colour can match a blur.
			backgroundStyle={{ backgroundColor: colors.background }}
		>
			<View className="flex-1 bg-background">
				{/* Explicit heights, so what the floor above subtracts is what the chrome
				    is — and so both survive the frames where their own contents measure
				    to zero. */}
				<View
					className="items-center justify-center px-5"
					style={{ height: TITLE_HEIGHT }}
				>
					<Text className="font-sans-semibold text-foreground text-headline">
						{t("onboarding.currency.picker.title")}
					</Text>
				</View>

				<View className="px-5 pb-2" style={{ height: SEARCH_HEIGHT }}>
					<View className="flex-1 flex-row items-center gap-2 rounded-full bg-surface px-4">
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

				<CurrencyPickerList
					contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
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
});
