import {
	BottomSheetFlatList,
	BottomSheetModal,
	BottomSheetTextInput,
} from "@expo/ui/community/bottom-sheet";
import { CURRENCY_META } from "@outlayr/money";
import { SymbolView } from "expo-symbols";
import { forwardRef, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, {
	Easing,
	LinearTransition,
	ReduceMotion,
} from "react-native-reanimated";
import { useLocalData } from "@/contexts/local-data-context";
import {
	toggleFavouriteCurrency,
	useFavouriteCurrencies,
} from "@/data/favourite-currencies";
import {
	type CurrencyCode,
	type CurrencyPickerRow,
	currencyPickerRows,
} from "@/domain/currency-picker-rows";
import {
	FAVOURITE_CURRENCY_LIMIT,
	isFavourite,
} from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";

/**
 * The row's travel between the two sections.
 *
 * `ease-in-out`, because the row is already on screen and stays on screen — it
 * accelerates out of one section and brakes into the other, which is what a
 * moving object does. An `ease-out` would read as an arrival from off-screen.
 *
 * Only `layout` is animated, never `entering`/`exiting`: the list is virtualised
 * over 165 currencies, so rows mount and unmount constantly while scrolling, and
 * an enter/exit animation would fire on all of them. The star is pressed rarely;
 * scrolling is not. `ReduceMotion.System` drops the travel for anyone who asked
 * the OS for less motion — they still get the reorder, just without the flight.
 */
const ROW_TRAVEL = LinearTransition.duration(260)
	.easing(Easing.bezier(0.645, 0.045, 0.355, 1).factory())
	.reduceMotion(ReduceMotion.System);

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
	// The nullable `db` from the context, not `useDatabase()`: the sheet is mounted
	// by forms whose own callers can sit above the root splash gate, where
	// `useDatabase()` throws.
	const { db } = useLocalData();
	const favourites = useFavouriteCurrencies(db);

	const rows = useMemo<readonly CurrencyPickerRow[]>(
		() => currencyPickerRows(favourites, query),
		[favourites, query],
	);

	// The refusal is read off the list the write actually produced, not off
	// `favourites.length` at press time: toggles are serialised, so a row rendered
	// a tick before another one landed would otherwise mis-read the cap.
	const onToggleFavourite = (code: string, favourite: boolean) => {
		if (db === null) {
			return;
		}
		toggleFavouriteCurrency(db, code).then((next) => {
			if (!favourite && !isFavourite(next, code)) {
				Alert.alert(
					t("settings.currency.favourites"),
					t("settings.currency.favouritesFull", {
						limit: FAVOURITE_CURRENCY_LIMIT,
					}),
				);
			}
		});
	};

	return (
		<BottomSheetModal
			ref={ref}
			snapPoints={["55%", "100%"]}
			enableDynamicSizing={false}
			enablePanDownToClose
		>
			<View className="flex-1">
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
					renderItem={({ item: row }: { item: CurrencyPickerRow }) =>
						row.kind === "header" ? (
							// Carries the row timing rather than snapping: the headers shift by
							// the same amount as the rows around them, and two different speeds
							// in one reflow read as two things happening, not one.
							<Animated.View layout={ROW_TRAVEL}>
								<MonoLabel className="pt-4 pb-1">
									{t(
										row.section === "favourites"
											? "settings.currency.favourites"
											: "settings.currency.all",
									)}
								</MonoLabel>
							</Animated.View>
						) : (
							<CurrencyRow
								code={row.code}
								favourite={row.favourite}
								onPress={() => onSelect(row.code)}
								onToggleFavourite={
									db === null
										? null
										: () => onToggleFavourite(row.code, row.favourite)
								}
								selected={row.code === selected}
							/>
						)
					}
				/>
			</View>
		</BottomSheetModal>
	);
});

function CurrencyRow({
	code,
	favourite,
	selected,
	onPress,
	onToggleFavourite,
}: {
	code: CurrencyCode;
	favourite: boolean;
	selected: boolean;
	onPress: () => void;
	/** `null` while no database is open, so the star is absent rather than dead. */
	onToggleFavourite: (() => void) | null;
}) {
	const colors = useColors();
	const meta = CURRENCY_META[code];
	const t = useTranslation();
	return (
		<Animated.View
			className="flex-row items-center border-border border-b"
			layout={ROW_TRAVEL}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ selected }}
				className="flex-1 flex-row items-center gap-3 py-3 active:opacity-60"
				onPress={onPress}
			>
				<View className="w-9 items-center">
					<Text
						className="text-body text-muted"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{meta.symbol}
					</Text>
				</View>
				<View className="flex-1">
					<Text className="text-body text-foreground">{code}</Text>
					<Text className="text-footnote text-muted" numberOfLines={1}>
						{meta.name}
					</Text>
				</View>
				{/* Reserved whether or not the checkmark is drawn, so the star beside it
				    keeps one column down the whole list. */}
				<View className="w-5 items-center">
					{selected ? (
						<SymbolView
							name="checkmark"
							size={18}
							weight="semibold"
							tintColor={colors.tint}
							type="monochrome"
						/>
					) : null}
				</View>
			</Pressable>
			{onToggleFavourite === null ? null : (
				<Pressable
					accessibilityLabel={t(
						favourite
							? "settings.currency.unfavourite"
							: "settings.currency.favourite",
						{ code },
					)}
					accessibilityRole="button"
					accessibilityState={{ selected: favourite }}
					className="ml-2 size-7 items-center justify-center active:opacity-60"
					// 28pt box plus 8 a side is the 44pt minimum target without making the
					// row taller than the two lines of text next to it.
					hitSlop={8}
					onPress={onToggleFavourite}
				>
					<SymbolView
						name={favourite ? "star.fill" : "star"}
						size={17}
						weight="semibold"
						tintColor={favourite ? colors.tint : colors.muted}
						type="monochrome"
					/>
				</Pressable>
			)}
		</Animated.View>
	);
}
