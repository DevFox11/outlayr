import { LegendList } from "@legendapp/list/react-native";
import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import {
	type CurrencyPickerRow,
	currencyPickerRows,
} from "@/domain/currency-picker-rows";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";
import {
	CurrencyHint,
	CurrencyRow,
	CurrencySectionHeader,
} from "./currency-picker-row";

interface CurrencyPickerListProps {
	favourites: readonly string[];
	query: string;
	selected: string;
	onSelect: (code: string) => void;
	/** `null` while no database is open, so favouriting is absent rather than dead. */
	onToggleFavourite: ((code: string, favourite: boolean) => void) | null;
	style?: StyleProp<ViewStyle>;
	/** The sheet needs its own padding; the settings screen takes the default. */
	contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * A virtualised list, not `@expo/ui`'s SwiftUI `List`.
 *
 * The SwiftUI one is not virtualised at all — it mounts every child it is given,
 * which for 165 currencies was one ~550ms commit that nothing could paint around.
 * That showed up as 1.75s of dead screen after tapping Settings › Currency, a
 * stall on every keystroke, and a second stall on clearing the search, when the
 * list grows back from a few matches to the whole catalogue.
 *
 * What it gave in exchange — `allowsFullSwipe`, a context menu, inset separators
 * — the row provides itself, so the trade was one-sided once the cost was
 * measured properly.
 */
export function CurrencyPickerList({
	favourites,
	query,
	selected,
	onSelect,
	onToggleFavourite,
	style,
	contentContainerStyle,
}: CurrencyPickerListProps) {
	const rows = useMemo<readonly CurrencyPickerRow[]>(
		() => currencyPickerRows(favourites, query),
		[favourites, query],
	);

	const full = favourites.length >= FAVOURITE_CURRENCY_LIMIT;

	return (
		<View className="flex-1 bg-background" style={style}>
			<LegendList
				contentContainerStyle={contentContainerStyle}
				contentInsetAdjustmentBehavior="automatic"
				data={rows as CurrencyPickerRow[]}
				// Three pools. A header, the one-off hint and a currency row share no
				// layout, and recycling across them is what makes a mixed list stutter.
				getItemType={(row: CurrencyPickerRow) => row.kind}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(row: CurrencyPickerRow) => row.key}
				// `ReanimatedSwipeable` keeps its open/closed offset inside the row
				// instance, so a recycled row would inherit the previous row's swipe.
				recycleItems={false}
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
							full={full}
							onPress={() => onSelect(row.code)}
							onToggleFavourite={
								onToggleFavourite === null
									? null
									: () => onToggleFavourite(row.code, row.favourite)
							}
							selected={row.code === selected}
						/>
					);
				}}
			/>
		</View>
	);
}
