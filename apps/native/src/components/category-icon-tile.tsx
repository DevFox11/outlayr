import { useTheme } from "panelui-native";
import { type ReactNode, useState } from "react";
import { Image, Text, View } from "react-native";
import { glyphShade, TILE_WASH_OPACITY, withAlpha } from "@/theme/shade";
import { CategoryIcon, type CategoryIconType } from "./category-icon";

/**
 * Only 28 and 34 fall out of the proportional 0.52 below, so the large tile has to
 * be pinned or its glyph comes out 5pt too big. 36 is the Log row's tile: a 20pt
 * glyph in 8pt of padding, and it takes a 9pt radius rather than this one's 10.
 */
const GLYPH_RAMP: Record<number, number> = { 28: 15, 34: 18, 36: 20, 90: 42 };

interface CategoryIconTileProps {
	color: string;
	icon: string | null | undefined;
	/**
	 * Storage is icon XOR emoji, so this only decides legacy rows: a stored icon
	 * takes precedence, then the emoji, then the namespace fallback icon.
	 */
	emoji?: string | null;
	/** Outer tile edge length; the glyph and radius scale from it. */
	size?: number;
	radius?: number;
	type?: CategoryIconType;
	/**
	 * Upcoming/scheduled state: the fill drops for a dashed tint ring and the whole
	 * tile fades.
	 */
	future?: boolean;
	/** A stored photo renders as a squircle thumbnail in place of the glyph tile. */
	imageUri?: string | null;
	/**
	 * Draws in place of the registry glyph, in the tile's own shade and size. The
	 * ghost "add" slot needs a bare "+", which must not become a pickable category
	 * icon by being added to `CategoryIcon`'s registry.
	 */
	glyph?: (props: { color: string; size: number }) => ReactNode;
}

export function CategoryIconTile({
	color,
	icon,
	emoji = null,
	size = 34,
	radius: radiusOverride,
	type = "stroke",
	future = false,
	imageUri = null,
	glyph,
}: CategoryIconTileProps) {
	const { theme } = useTheme();
	const isDark = theme === "dark";
	// Keyed by uri rather than reset in an effect, so pointing the tile at a
	// different photo re-arms it on the same render.
	const [unreadable, setUnreadable] = useState<string | null>(null);
	const radius = radiusOverride ?? (size >= 72 ? 20 : size >= 32 ? 10 : 8);
	const glyphSize = GLYPH_RAMP[size] ?? Math.round(size * 0.52);
	// A contrast-corrected shade of the tint, never the raw hex: a bright tint
	// vanishes into its own wash.
	const glyphColor = glyphShade(color, isDark);

	// A photo whose file the system reclaimed falls back to the glyph tile rather
	// than painting an empty frame.
	if (imageUri && unreadable !== imageUri) {
		return (
			<Image
				onError={() => setUnreadable(imageUri)}
				source={{ uri: imageUri }}
				style={{
					width: size,
					height: size,
					borderRadius: radius,
					borderWidth: future ? 2 : 1,
					borderColor: withAlpha(color, future ? 0.73 : 0.2),
					opacity: future ? 0.6 : 1,
				}}
				resizeMode="cover"
			/>
		);
	}

	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: radius,
				opacity: future ? 0.6 : 1,
				alignItems: "center",
				justifyContent: "center",
				...(future
					? {
							borderWidth: 2,
							borderColor: withAlpha(color, 0.73),
							borderStyle: "dashed" as const,
						}
					: { backgroundColor: withAlpha(color, TILE_WASH_OPACITY) }),
			}}
		>
			{glyph ? (
				glyph({ color: glyphColor, size: glyphSize })
			) : !icon && emoji ? (
				// An emoji carries its own colors, so the tint shade does not apply.
				<Text style={{ fontSize: glyphSize, lineHeight: glyphSize * 1.2 }}>
					{emoji}
				</Text>
			) : (
				<CategoryIcon
					name={icon}
					color={glyphColor}
					size={glyphSize}
					type={type}
					strokeWidth={size >= 72 ? 2 : 1.9}
				/>
			)}
		</View>
	);
}
