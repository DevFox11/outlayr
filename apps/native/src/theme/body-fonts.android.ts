import {
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
} from "@expo-google-fonts/google-sans-flex";

import type { BodyFonts, SansWeight } from "./body-fonts";

export type { BodyFonts, SansWeight } from "./body-fonts";

/**
 * Google Sans Flex, Material You's body face, one static file per weight.
 * Android cannot pick a weight out of one `useFonts` family, so each weight is
 * its own family name and `text.android.tsx` and the `font-sans-*` utilities
 * choose by weight. Kept out of the iOS bundle by being an Android sibling.
 */
export const SANS_BY_WEIGHT: Record<SansWeight, string> = {
    400: "GoogleSansFlex_400Regular",
    500: "GoogleSansFlex_500Medium",
    600: "GoogleSansFlex_600SemiBold",
    700: "GoogleSansFlex_700Bold",
};

export const BODY_FONTS: BodyFonts = {
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
};
