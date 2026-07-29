import { Pressable, View } from "react-native";
import { CategoryIcon } from "@/components/category-icon";
import { Text } from "@/components/text";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useTranslation } from "@/i18n";
import { glyphShade, withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

/**
 * The leaf views both identity pickers draw: a glyph cell, an emoji cell, and a
 * colour swatch.
 */

export const SYMBOL_COLUMNS = 6;
export const SYMBOL_GAP = 10;
export const SYMBOL_MARGIN = 20;
export const SYMBOL_CELL_RADIUS = 10;
/** The tint wash under a selected cell. */
export const SYMBOL_SELECTED_WASH = 0.18;
const EMOJI_SIZE = 26;
const GLYPH_SIZE = 20;

/** Cells are square in a flexible column, so they grow with the sheet. */
export function symbolCellSize(width: number): number {
	return Math.floor(
		(width - SYMBOL_MARGIN * 2 - SYMBOL_GAP * (SYMBOL_COLUMNS - 1)) /
			SYMBOL_COLUMNS,
	);
}

interface SymbolCellProps {
	/** Effective identity tint — the category colour, or income green. */
	tint: string;
	selected: boolean;
	size: number;
	onPress: () => void;
}

function useCellStyle(tint: string, selected: boolean, size: number) {
	const colors = useColors();
	return {
		width: size,
		height: size,
		borderRadius: SYMBOL_CELL_RADIUS,
		alignItems: "center" as const,
		justifyContent: "center" as const,
		borderWidth: selected ? 2 : 0,
		borderColor: tint,
		// `colors.surface`, NOT the grouped-cell colour, which is lighter than the
		// sheet these sit on.
		backgroundColor: selected
			? withAlpha(tint, SYMBOL_SELECTED_WASH)
			: colors.surface,
	};
}

export function SymbolIconCell({
	iconKey,
	tint,
	selected,
	size,
	onPress,
}: SymbolCellProps & { iconKey: string }) {
	const colors = useColors();
	const { isDark } = useAppTheme();
	return (
		<Pressable
			accessibilityLabel={iconKey}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={useCellStyle(tint, selected, size)}
		>
			<CategoryIcon
				color={selected ? glyphShade(tint, isDark) : colors.muted}
				name={iconKey}
				size={GLYPH_SIZE}
				type="solid"
			/>
		</Pressable>
	);
}

export function SymbolEmojiCell({
	emoji,
	tint,
	selected,
	size,
	onPress,
}: SymbolCellProps & { emoji: string }) {
	return (
		<Pressable
			accessibilityLabel={emoji}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={useCellStyle(tint, selected, size)}
		>
			<Text style={{ fontSize: EMOJI_SIZE }}>{emoji}</Text>
		</Pressable>
	);
}

const SWATCH = 34;
const RING_INSET = 3;
export const SWATCH_BOX = SWATCH + RING_INSET * 2;

/**
 * `used` dims the swatch and disables it: a colour another expense category
 * already owns cannot be picked twice.
 */
export function ColorSwatch({
	hex,
	selected,
	used = false,
	onPress,
}: {
	hex: string;
	selected: boolean;
	used?: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	const t = useTranslation();
	const dimmed = used && !selected;
	return (
		<Pressable
			accessibilityHint={
				dimmed ? t("transaction.identity.colorUsed") : undefined
			}
			accessibilityLabel={hex}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			disabled={dimmed}
			onPress={onPress}
			style={({ pressed }) => ({
				width: SWATCH_BOX,
				height: SWATCH_BOX,
				alignItems: "center",
				justifyContent: "center",
				transform: [{ scale: pressed ? 0.92 : 1 }],
			})}
		>
			<View
				style={{
					width: SWATCH,
					height: SWATCH,
					borderRadius: SWATCH / 2,
					backgroundColor: hex,
					opacity: dimmed ? 0.3 : 1,
					// A dimmed swatch keeps a hairline INSIDE its edge; the selected one's
					// ring stands off the circle instead, so it never eats into the colour
					// it is marking.
					borderWidth: dimmed ? 1 : 0,
					borderColor: withAlpha(colors.foreground, 0.12),
				}}
			/>
			{selected ? (
				<View
					pointerEvents="none"
					style={{
						position: "absolute",
						width: SWATCH_BOX,
						height: SWATCH_BOX,
						borderRadius: SWATCH_BOX / 2,
						borderWidth: 2,
						borderColor: colors.foreground,
					}}
				/>
			) : null}
		</Pressable>
	);
}
