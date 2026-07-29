import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { NumberFlow } from "number-flow-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { currencySymbol } from "@/domain/money";
import {
	applyNumpadKey,
	type NumpadKey,
	numpadToNumber,
} from "@/domain/numpad";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";

const GLASS = isLiquidGlassAvailable();

const ROWS: NumpadKey[][] = [
	["1", "2", "3"],
	["4", "5", "6"],
	["7", "8", "9"],
	[".", "0", "back"],
];

interface AmountNumpadProps {
	value: string;
	minorUnits: number;
	code: string;
	toneClass?: string;
	onChange: (next: string) => void;
}

export function AmountNumpad({
	value,
	minorUnits,
	code,
	toneClass,
	onChange,
}: AmountNumpadProps) {
	const colors = useColors();
	const haptics = useHaptics();
	const symbol = currencySymbol(code);
	const amountColor = toneClass?.includes("income")
		? colors.income
		: colors.foreground;

	const press = (key: NumpadKey) => {
		haptics("keyTap");
		onChange(applyNumpadKey(value, key, minorUnits));
	};

	return (
		<View className="px-4">
			<View className="items-center pt-2">
				<Text className="font-sans text-body text-muted">Amount</Text>
			</View>
			<View className="min-h-14 items-center justify-center px-4 pt-2 pb-7">
				<NumberFlow
					value={numpadToNumber(value)}
					prefix={`${symbol} `}
					locales="en-US"
					format={{
						minimumFractionDigits: minorUnits,
						maximumFractionDigits: minorUnits,
						useGrouping: true,
					}}
					style={{
						fontFamily: "SFProRounded-Medium",
						fontSize: 40,
						color: amountColor,
					}}
				/>
			</View>
			<View className="gap-[9px]">
				{ROWS.map((row) => (
					<View key={row.join()} className="flex-row gap-[9px]">
						{row.map((key) => (
							<NumpadKeyTile
								key={key}
								label={key}
								hidden={key === "." && minorUnits === 0}
								fg={colors.foreground}
								onPress={() => press(key)}
							/>
						))}
					</View>
				))}
			</View>
		</View>
	);
}

function NumpadKeyTile({
	label,
	hidden,
	fg,
	onPress,
}: {
	label: NumpadKey;
	hidden: boolean;
	fg: string;
	onPress: () => void;
}) {
	if (hidden) {
		return <View className="h-16 flex-1" />;
	}
	return (
		<Pressable
			className="h-16 flex-1 items-center justify-center overflow-hidden rounded-2xl active:scale-[0.96] active:opacity-65"
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label === "back" ? "Delete" : label}
		>
			{GLASS ? (
				<GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
			) : (
				<View className="absolute inset-0 bg-surface" />
			)}
			{label === "back" ? (
				<SymbolView
					name="delete.left"
					size={26}
					weight="medium"
					tintColor={fg}
					type="monochrome"
				/>
			) : (
				<Text className="font-sans-medium text-[30px] text-foreground">
					{label}
				</Text>
			)}
		</Pressable>
	);
}
