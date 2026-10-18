import { useTheme } from "panelui-native/theme";
import { useState } from "react";
import type { ReactNode } from "react";
import { Image, Text, View } from "react-native";

import { glyphShade, TILE_WASH_OPACITY, withAlpha } from "@/theme/shade";

import { CategoryIcon } from "./category-icon";
import type { CategoryIconType } from "./category-icon";

/**
 * Only 28 and 34 fall out of the proportional 0.52 below, so the large tile has to
 * be pinned or its glyph comes out 5pt too big. 36 is the Log row's tile: a 20pt
 * glyph in 8pt of padding, and it takes a 9pt radius rather than this one's 10.
 */
// Keyed by the tile size a caller asks for, which is any number; sizes off the
// ramp fall through to the proportional default.
const GLYPH_RAMP = new Map<number, number>([
    [28, 15],
    [34, 18],
    [36, 20],
    [90, 42],
]);

function tileRadius(size: number): number {
    if (size >= 72) {
        return 20;
    }
    if (size >= 32) {
        return 10;
    }
    return 8;
}

interface CategoryIconTileProps {
    color: string;
    /**
     * Storage is icon XOR emoji, so this only decides legacy rows: a stored icon
     * takes precedence, then the emoji, then the namespace fallback icon.
     */
    emoji?: string | null;
    /**
     * Upcoming/scheduled state: the fill drops for a dashed tint ring and the whole
     * tile fades.
     */
    future?: boolean;
    /**
     * Draws in place of the registry glyph, in the tile's own shade and size. The
     * ghost "add" slot needs a bare "+", which must not become a pickable category
     * icon by being added to `CategoryIcon`'s registry.
     */
    glyph?: (props: { color: string; size: number }) => ReactNode;
    icon: string | null | undefined;
    /** A stored photo renders as a squircle thumbnail in place of the glyph tile. */
    imageUri?: string | null;
    radius?: number;
    /** Outer tile edge length; the glyph and radius scale from it. */
    size?: number;
    type?: CategoryIconType;
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
    const radius = radiusOverride ?? tileRadius(size);
    const glyphSize = GLYPH_RAMP.get(size) ?? Math.round(size * 0.52);
    // A contrast-corrected shade of the tint, never the raw hex: a bright tint
    // vanishes into its own wash.
    const glyphColor = glyphShade(color, isDark);

    // A photo whose file the system reclaimed falls back to the glyph tile rather
    // than painting an empty frame.
    if (imageUri && unreadable !== imageUri) {
        return (
            <Image
                onError={() => setUnreadable(imageUri)}
                resizeMode="cover"
                source={{ uri: imageUri }}
                style={{
                    borderColor: withAlpha(color, future ? 0.73 : 0.2),
                    borderRadius: radius,
                    borderWidth: future ? 2 : 1,
                    height: size,
                    opacity: future ? 0.6 : 1,
                    width: size,
                }}
            />
        );
    }

    let content: ReactNode;
    if (glyph) {
        content = glyph({ color: glyphColor, size: glyphSize });
    } else if (!icon && emoji) {
        // An emoji carries its own colors, so the tint shade does not apply.
        content = <Text style={{ fontSize: glyphSize, lineHeight: glyphSize * 1.2 }}>{emoji}</Text>;
    } else {
        content = (
            <CategoryIcon
                color={glyphColor}
                name={icon}
                size={glyphSize}
                strokeWidth={size >= 72 ? 2 : 1.9}
                type={type}
            />
        );
    }

    return (
        <View
            style={{
                alignItems: "center",
                borderRadius: radius,
                height: size,
                justifyContent: "center",
                opacity: future ? 0.6 : 1,
                width: size,
                ...(future
                    ? {
                          borderColor: withAlpha(color, 0.73),
                          borderStyle: "dashed" as const,
                          borderWidth: 2,
                      }
                    : { backgroundColor: withAlpha(color, TILE_WASH_OPACITY) }),
            }}
        >
            {content}
        </View>
    );
}
