import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { type Ref, useRef } from "react";
import { Pressable, View } from "react-native";
import { currencySymbol } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { AmountNumpad } from "./amount-numpad";
import { CurrencyPickerSheet } from "./currency-picker-sheet";
import { GlassButton } from "./glass-button";
import { Text } from "./text";

interface AmountEntrySheetProps {
	code: string;
	minorUnits: number;
	onChange: (next: string) => void;
	/** Omitted where the caller already owns a currency control of its own. */
	onCurrencyChange?: (code: string) => void;
	onDone: () => void;
	ref?: Ref<BottomSheetModal>;
	toneClass?: string;
	value: string;
}

export function AmountEntrySheet({
	value,
	minorUnits,
	code,
	toneClass,
	onChange,
	onCurrencyChange,
	onDone,
	ref,
}: AmountEntrySheetProps) {
	const colors = useColors();
	const t = useTranslation();
	const symbol = currencySymbol(code);
	const currencySheetRef = useRef<BottomSheetModal>(null);

	return (
		<BottomSheetModal enableDynamicSizing enablePanDownToClose ref={ref}>
			<BottomSheetView style={{ paddingBottom: 8 }}>
				<View className="flex-row items-center justify-between px-4 pt-2 pb-1">
					{onCurrencyChange ? (
						<GlassButton
							accessibilityLabel={t("transaction.amount.changeCurrency")}
							className="h-11 rounded-[22px] px-[15px]"
							onPress={() => currencySheetRef.current?.present()}
						>
							<Text className="font-sans-semibold text-body text-foreground">{`${code} (${symbol})`}</Text>
							<SymbolView name="chevron.down" size={12} tintColor={colors.muted} type="monochrome" weight="semibold" />
						</GlassButton>
					) : (
						<Text className="px-[15px] font-sans-semibold text-body text-muted">{`${code} (${symbol})`}</Text>
					)}

					<GlassButton accessibilityLabel={t("common.close")} className="size-11 rounded-[22px]" onPress={onDone}>
						<SymbolView name="xmark" size={18} tintColor={colors.muted} type="monochrome" weight="semibold" />
					</GlassButton>
				</View>

				<View className="px-4">
					<AmountNumpad code={code} minorUnits={minorUnits} onChange={onChange} toneClass={toneClass} value={value} />
				</View>

				<View className="px-4 pt-6">
					<Pressable
						accessibilityRole="button"
						className="h-14 items-center justify-center rounded-[28px] bg-foreground active:opacity-70"
						onPress={onDone}
					>
						<Text className="font-sans-semibold text-background text-callout">{t("common.done")}</Text>
					</Pressable>
				</View>
			</BottomSheetView>

			{onCurrencyChange ? (
				<CurrencyPickerSheet
					onSelect={(next) => {
						onCurrencyChange(next);
						currencySheetRef.current?.dismiss();
					}}
					ref={currencySheetRef}
					selected={code}
				/>
			) : null}
		</BottomSheetModal>
	);
}
