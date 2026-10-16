import type { FontSource } from "expo-font";

/** The weights the body face is drawn in; anything else rounds to the nearest. */
export type SansWeight = 400 | 500 | 600 | 700;

/**
 * The body face, by the weight a caller asks for. iOS draws it with the system
 * rounded face, which takes the weight as a style and needs nothing loaded;
 * `body-fonts.android.ts` names one Google Sans Flex file per weight instead.
 */
export const SANS_BY_WEIGHT: Record<SansWeight, string> = {
    400: "ui-rounded",
    500: "ui-rounded",
    600: "ui-rounded",
    700: "ui-rounded",
};

/** Font files keyed by the family name `useFonts` registers each under. */
export type BodyFonts = Record<string, FontSource>;

/** Font files the root loader adds to its own. None on iOS. */
export const BODY_FONTS: BodyFonts = {};
