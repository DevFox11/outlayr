import type { TextStyle } from "react-native";

interface HeroType {
    /** Spread into a hero's text style. Empty keeps the face its classes name. */
    face: Pick<TextStyle, "fontFamily">;
    /** Multiplies the figure's size, before it is fitted to the width. */
    scale: number;
}

/**
 * How a headline amount (the Log's and Insights' hero) is set beyond its
 * classes. Nothing on iOS, which draws it in the body face at the call site's
 * size; `hero-type.android.ts` is Direction B's Instrument Serif.
 */
export const HERO_TYPE: HeroType = { face: {}, scale: 1 };
