import {
	BottomSheetFlatList,
	BottomSheetModal,
	BottomSheetTextInput,
} from "@expo/ui/community/bottom-sheet";
import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { SymbolView } from "expo-symbols";
import { forwardRef, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";

type CurrencyCode = (typeof PICKABLE_CURRENCY_CODES)[number];

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

	const results = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (trimmed === "") {
			return PICKABLE_CURRENCY_CODES;
		}
		return PICKABLE_CURRENCY_CODES.filter(
			(code) =>
				code.toLowerCase().includes(trimmed) ||
				CURRENCY_META[code].name.toLowerCase().includes(trimmed),
		);
	}, [query]);

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
						Select a currency
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
							placeholder="Search currencies"
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
					data={results}
					keyExtractor={(code) => code}
					contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
					keyboardShouldPersistTaps="handled"
					renderItem={({ item }) => (
						<CurrencyRow
							code={item}
							selected={item === selected}
							onPress={() => onSelect(item)}
						/>
					)}
				/>
			</View>
		</BottomSheetModal>
	);
});

function CurrencyRow({
	code,
	selected,
	onPress,
}: {
	code: CurrencyCode;
	selected: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	const meta = CURRENCY_META[code];
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
					{meta.symbol}
				</Text>
			</View>
			<View className="flex-1">
				<Text className="text-body text-foreground">{code}</Text>
				<Text className="text-footnote text-muted" numberOfLines={1}>
					{meta.name}
				</Text>
			</View>
			{selected ? (
				<SymbolView
					name="checkmark"
					size={18}
					weight="semibold"
					tintColor={colors.tint}
					type="monochrome"
				/>
			) : null}
		</Pressable>
	);
}
