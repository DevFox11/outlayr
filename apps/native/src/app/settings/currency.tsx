import { HugeiconsIcon } from "@hugeicons/react-native";
import { StarIcon as StarSolidIcon } from "@hugeicons-pro/core-solid-rounded";
import { StarIcon, Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	toggleFavouriteCurrency,
	useFavouriteCurrencies,
} from "@/data/favourite-currencies";
import { setCurrency } from "@/data/settings";
import type { Database } from "@/db/client";
import {
	FAVOURITE_CURRENCY_LIMIT,
	isFavourite,
} from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

interface CurrencyItem {
	code: string;
	name: string;
	symbol: string;
}

const ALL_CURRENCIES: readonly CurrencyItem[] = PICKABLE_CURRENCY_CODES.map(
	(code) => ({
		code,
		name: CURRENCY_META[code].name,
		symbol: CURRENCY_META[code].symbol,
	}),
);

const BY_CODE: ReadonlyMap<string, CurrencyItem> = new Map(
	ALL_CURRENCIES.map((item): [string, CurrencyItem] => [item.code, item]),
);

type Row =
	| { kind: "header"; key: string }
	| { kind: "currency"; key: string; item: CurrencyItem; favourite: boolean };

function currencyRow(item: CurrencyItem, favourite: boolean, key: string): Row {
	return { kind: "currency", key, item, favourite };
}

export default function CurrencyPickerScreen() {
	const db = useDatabase();
	return <CurrencyPicker db={db} />;
}

function CurrencyPicker({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const selected = useGlobalCurrency(db);
	const favourites = useFavouriteCurrencies(db);
	const [query, setQuery] = useState("");

	const rows = useMemo<readonly Row[]>(() => {
		const trimmed = query.trim().toLowerCase();
		const matches =
			trimmed === ""
				? ALL_CURRENCIES
				: ALL_CURRENCIES.filter(
						(item) =>
							item.code.toLowerCase().includes(trimmed) ||
							item.name.toLowerCase().includes(trimmed),
					);
		const full = matches.map((item) =>
			currencyRow(item, isFavourite(favourites, item.code), item.code),
		);
		// A search is already the shortcut: clustering on top of it would push the
		// match the user typed below the fold.
		if (trimmed !== "" || favourites.length === 0) {
			return full;
		}
		// The cluster repeats its codes rather than lifting them out of the list
		// below: an alphabet with holes punched in it is harder to scan than one
		// with a shortcut above it.
		const cluster = favourites.flatMap((code) => {
			const item = BY_CODE.get(code);
			return item === undefined
				? []
				: [currencyRow(item, true, `favourite:${code}`)];
		});
		return [{ kind: "header", key: "favourites" }, ...cluster, ...full];
	}, [favourites, query]);

	const onSelect = (code: string) => {
		setCurrency(db, code).then(() => router.back());
	};

	// The refusal is read off the list the write actually produced, not off
	// `favourites.length` at press time: toggles are serialised, so a row rendered
	// a tick before another one landed would otherwise mis-read the cap.
	const onToggleFavourite = (code: string, favourite: boolean) => {
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
				renderItem={({ item: row }) =>
					row.kind === "header" ? (
						<MonoLabel className="pt-4 pb-2">
							{t("settings.currency.favourites")}
						</MonoLabel>
					) : (
						<CurrencyRow
							favourite={row.favourite}
							item={row.item}
							onPress={() => onSelect(row.item.code)}
							onToggleFavourite={() =>
								onToggleFavourite(row.item.code, row.favourite)
							}
							selected={row.item.code === selected}
						/>
					)
				}
			/>
		</View>
	);
}

function CurrencyRow({
	item,
	favourite,
	selected,
	onPress,
	onToggleFavourite,
}: {
	item: CurrencyItem;
	favourite: boolean;
	selected: boolean;
	onPress: () => void;
	onToggleFavourite: () => void;
}) {
	const colors = useColors();
	const t = useTranslation();
	return (
		<View className="flex-row items-center border-border border-b">
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
						{item.symbol}
					</Text>
				</View>
				<View className="flex-1">
					<Text className="text-body text-foreground">{item.code}</Text>
					<Text className="text-footnote text-muted" numberOfLines={1}>
						{item.name}
					</Text>
				</View>
				{/* Reserved whether or not the tick is drawn, so the star beside it
				    keeps one column down the whole list. */}
				<View className="w-5 items-center">
					{selected ? (
						<HugeiconsIcon
							color={colors.tint}
							icon={Tick02Icon}
							size={20}
							strokeWidth={2.4}
						/>
					) : null}
				</View>
			</Pressable>
			<Pressable
				accessibilityLabel={t(
					favourite
						? "settings.currency.unfavourite"
						: "settings.currency.favourite",
					{ code: item.code },
				)}
				accessibilityRole="button"
				accessibilityState={{ selected: favourite }}
				className="ml-2 size-7 items-center justify-center active:opacity-60"
				// 28pt box plus 8 a side is the 44pt minimum target without making the
				// row taller than the two lines of text next to it.
				hitSlop={8}
				onPress={onToggleFavourite}
			>
				<HugeiconsIcon
					color={favourite ? colors.tint : colors.muted}
					icon={favourite ? StarSolidIcon : StarIcon}
					size={18}
					strokeWidth={2}
				/>
			</Pressable>
		</View>
	);
}
