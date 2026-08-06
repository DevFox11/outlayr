import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { AmountNumpad } from "../amount-numpad";

interface TransactionFormAmountPadProps {
	value: string;
	minorUnits: number;
	code: string;
	income: boolean;
	onChange: (next: string) => void;
	onDismiss: () => void;
	onHeight?: (height: number) => void;
}

export function TransactionFormAmountPad({
	value,
	minorUnits,
	code,
	income,
	onChange,
	onDismiss,
	onHeight,
}: TransactionFormAmountPadProps) {
	const colors = useColors();
	const t = useTranslation();

	return (
		<View
			className="absolute right-0 bottom-0 left-0 rounded-t-[28px] bg-background px-4 pt-2 pb-safe-offset-3"
			onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
			testID="amount-pad"
		>
			<View className="flex-row justify-end pb-1">
				<Pressable
					accessibilityLabel={t("common.done")}
					accessibilityRole="button"
					className="size-9 items-center justify-center rounded-full active:opacity-60"
					onPress={onDismiss}
				>
					<SymbolView
						name="chevron.down"
						size={15}
						tintColor={colors.muted}
						type="monochrome"
						weight="semibold"
					/>
				</Pressable>
			</View>
			<AmountNumpad
				code={code}
				minorUnits={minorUnits}
				onChange={onChange}
				showDisplay={false}
				toneClass={income ? "text-income" : "text-foreground"}
				value={value}
			/>
		</View>
	);
}
