import type { LucideIcon } from "lucide-react-native";
import type { ColorValue } from "react-native";

export type IconComponent = LucideIcon;

/**
 * Renders a Lucide icon. Call sites have always passed size, colour and stroke
 * width around (the weight of a glyph is part of the design), so those three are
 * the whole surface.
 */
export function Icon({
    color,
    icon: Glyph,
    size = 24,
    strokeWidth,
}: {
    color?: ColorValue;
    icon: IconComponent;
    size?: number;
    strokeWidth?: number;
}) {
    // SAFETY: react-native-svg accepts any ColorValue; Lucide only types the common string case.
    return <Glyph color={color as string | undefined} size={size} strokeWidth={strokeWidth} />;
}
