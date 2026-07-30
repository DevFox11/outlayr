import { eq } from "drizzle-orm";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { NumberFlow } from "number-flow-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalData } from "@/contexts/local-data-context";
import { useLiveQuery } from "@/data/live-query";
import { parseIntSetting, SETTING_DEFAULTS } from "@/data/settings";
import { appMeta } from "@/db/schema";
import { currencySymbol } from "@/domain/money";
import {
	applyNumpadKey,
	type NumpadKey,
	type NumpadMode,
	type NumpadTileKey,
	numpadMode,
	numpadToNumber,
} from "@/domain/numpad";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";

const GLASS = isLiquidGlassAvailable();

const ROWS: NumpadTileKey[][] = [
	["1", "2", "3"],
	["4", "5", "6"],
	["7", "8", "9"],
	[".", "0", "back"],
];

/**
 * The nullable `db` from the context, not `useDatabase()`: the keypad is mounted
 * by sheets whose own callers can sit above the root splash gate. An unread
 * setting resolves to its default, which is the mode the keypad has always had.
 */
function useNumpadMode(): NumpadMode {
	const { db } = useLocalData();
	const rows = useLiveQuery(
		appMeta,
		() =>
			db === null
				? { all: (): { value: string | null }[] => [] }
				: db
						.select({ value: appMeta.value })
						.from(appMeta)
						.where(eq(appMeta.key, "numberEntryType")),
		[db],
	);
	return numpadMode(
		parseIntSetting(rows[0]?.value ?? null, SETTING_DEFAULTS.numberEntryType),
	);
}

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
	const t = useTranslation();
	const mode = useNumpadMode();
	const symbol = currencySymbol(code);
	const amountColor = toneClass?.includes("income")
		? colors.income
		: colors.foreground;

	const press = (key: NumpadKey) => {
		// A long press has no tell of its own beyond the amount resetting, and
		// `keyTap` is silent below the excessive haptics level.
		haptics(key === "clear" ? "medium" : "keyTap");
		onChange(applyNumpadKey(value, key, minorUnits, mode));
	};

	return (
		// No horizontal inset of its own: the caller owns it, so the keys line up
		// with whatever sits under them — the sheet's Done button at `px-4`, the
		// first-run CTA at `px-6`.
		<View>
			<View className="items-center pt-2">
				<Text className="font-sans text-body text-muted">
					{t("transaction.field.amount")}
				</Text>
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
								hidden={
									key === "." && (minorUnits === 0 || mode === "preDotted")
								}
								fg={colors.foreground}
								onPress={() => press(key)}
								onLongPress={key === "back" ? () => press("clear") : undefined}
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
	onLongPress,
}: {
	label: NumpadTileKey;
	hidden: boolean;
	fg: string;
	onPress: () => void;
	onLongPress?: () => void;
}) {
	const t = useTranslation();
	if (hidden) {
		return <View className="h-16 flex-1" />;
	}
	return (
		<Pressable
			className="h-16 flex-1 items-center justify-center overflow-hidden rounded-2xl active:scale-[0.96] active:opacity-65"
			onPress={onPress}
			onLongPress={onLongPress}
			accessibilityRole="button"
			accessibilityLabel={
				label === "back" ? t("transaction.numpad.delete") : label
			}
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
