import { useWindowDimensions } from "react-native";

export const LARGEST_STANDARD_FONT_SCALE = 1.353;

export function useAccessibilityTextSize(): boolean {
    return useWindowDimensions().fontScale > LARGEST_STANDARD_FONT_SCALE;
}
