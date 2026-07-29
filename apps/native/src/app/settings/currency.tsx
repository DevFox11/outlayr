import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { setCurrency } from "@/data/settings";
import type { Database } from "@/db/client";
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

export default function CurrencyPickerScreen() {
	const db = useDatabase();
	return <CurrencyPicker db={db} />;
}

function CurrencyPicker({ db }: { db: Database }) {
	const router = useRouter();
	const selected = useGlobalCurrency(db);
	const [query, setQuery] = useState("");

	const results = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (trimmed === "") {
			return ALL_CURRENCIES;
		}
		return ALL_CURRENCIES.filter(
			(item) =>
				item.code.toLowerCase().includes(trimmed) ||
				item.name.toLowerCase().includes(trimmed),
		);
	}, [query]);

	const onSelect = (code: string) => {
		setCurrency(db, code).then(() => router.back());
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.SearchBar
				autoCapitalize="characters"
				hideWhenScrolling={false}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Search currencies"
			/>
			<FlatList
				contentInsetAdjustmentBehavior="automatic"
				data={results}
				keyExtractor={(item) => item.code}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
				renderItem={({ item }) => (
					<CurrencyRow
						item={item}
						selected={item.code === selected}
						onPress={() => onSelect(item.code)}
					/>
				)}
			/>
		</View>
	);
}

function CurrencyRow({
	item,
	selected,
	onPress,
}: {
	item: CurrencyItem;
	selected: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	return (
		<Pressable
			className="flex-row items-center gap-3 border-border border-b py-3 active:opacity-60"
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
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
			{selected ? (
				<HugeiconsIcon
					icon={Tick02Icon}
					size={20}
					color={colors.tint}
					strokeWidth={2.4}
				/>
			) : null}
		</Pressable>
	);
}
