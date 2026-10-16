import { FontWeight, Skia } from "@shopify/react-native-skia";
import type { SkTypeface } from "@shopify/react-native-skia";

import type { CardWeight } from "@/domain/day-card";

/** One face per card weight. */
export type CardTypefaces = Readonly<Record<CardWeight, SkTypeface>>;

const WEIGHTS = {
    medium: FontWeight.Medium,
    mono: FontWeight.Medium,
    regular: FontWeight.Normal,
    semibold: FontWeight.SemiBold,
} satisfies Record<CardWeight, FontWeight>;

/**
 * The families to try, in order. Skia's `matchFamilyStyle` never returns null:
 * for a name it cannot match (the empty one included) it hands back a typeface
 * around nothing, which draws blank. The lookup used to start at the empty
 * name and stop there, so the card shipped with its rules and no text.
 */
const FAMILIES = ["System", "Helvetica Neue", "sans-serif"];

/** A typeface that matched nothing measures zero. */
function draws(typeface: SkTypeface): boolean {
    return Skia.Font(typeface, 12).measureText("A").width > 0;
}

const TYPEFACES = new Map<CardWeight, SkTypeface>();

function typefaceFor(weight: CardWeight): SkTypeface {
    const cached = TYPEFACES.get(weight);
    if (cached) {
        return cached;
    }
    const manager = Skia.FontMgr.System();
    for (const family of FAMILIES) {
        const candidate = manager.matchFamilyStyle(family, { weight: WEIGHTS[weight] });
        if (draws(candidate)) {
            TYPEFACES.set(weight, candidate);
            return candidate;
        }
    }
    // `Skia.Font` throws without a typeface, so there is no default face to
    // fall back on: better a failed share than a blank card.
    throw new Error(`No system face draws the day card's ${weight} text`);
}

/**
 * The faces the day card is drawn in: the system face at each weight.
 * `day-card-fonts.android.ts` loads the app's own files instead, for Direction
 * B's faces.
 */
export async function loadCardTypefaces(): Promise<CardTypefaces> {
    return {
        medium: typefaceFor("medium"),
        mono: typefaceFor("mono"),
        regular: typefaceFor("regular"),
        semibold: typefaceFor("semibold"),
    };
}
