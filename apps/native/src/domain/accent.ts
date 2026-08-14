import type { TranslationKey } from "@/i18n/catalog";

/**
 * The colour the app uses to say "this does something", per theme.
 *
 * Settings calls this the **Theme** and calls light/dark the **Color Scheme**.
 * The code keeps the other pair of words on purpose: uniwind and PanelUI both
 * use `theme` for light/dark (`setTheme`, `useTheme`, `updateCSSVariables`), so
 * naming this one `Theme` in code would collide with the library underneath it.
 *
 * Both halves are declared because a hue that reads on paper does not read on
 * the dark face and the other way round: each is the same hue fitted to the
 * theme it is written over. Every value here clears 4.5:1 against all four
 * grounds its theme paints — `token-contrast.test.ts` is what keeps that true,
 * and it is the reason three of these are not the hue's "obvious" value.
 */
export interface Accent {
    dark: string;
    key: AccentKey;
    label: TranslationKey;
    light: string;
    /** Stored in the `accentColor` setting. Append only; never renumber. */
    value: number;
}

export type AccentKey = "vermilion" | "plum" | "ochre" | "prussian" | "pine";

/**
 * Vermilion is the icon's own hue and stays the default; it is the only one
 * with a claim to being the brand rather than a preference.
 *
 * The other four are matched to its perceptual weight rather than picked by
 * eye, so switching changes the app's character without making it louder or
 * quieter. Ochre, prussian and pine are darker than their nominal hue: at
 * vermilion's lightness they miss the floor on `--surface-secondary`, which is
 * the darkest plane the light theme paints.
 */
export const ACCENTS: readonly Accent[] = [
    { dark: "#ec603b", key: "vermilion", label: "settings.theme.vermilion", light: "#c2371b", value: 0 },
    { dark: "#be68e1", key: "plum", label: "settings.theme.plum", light: "#9742b9", value: 1 },
    { dark: "#c57d00", key: "ochre", label: "settings.theme.ochre", light: "#965e00", value: 2 },
    { dark: "#0092e6", key: "prussian", label: "settings.theme.prussian", light: "#006fb0", value: 3 },
    { dark: "#00a15c", key: "pine", label: "settings.theme.pine", light: "#007b45", value: 4 },
];

export const [DEFAULT_ACCENT] = ACCENTS;

/** Falls back to the default rather than throwing: the value comes from storage. */
export function accentForValue(value: number): Accent {
    return ACCENTS.find((accent) => accent.value === value) ?? DEFAULT_ACCENT;
}

/** The two CSS variables an accent drives, named so the pair is the contract. */
export interface AccentVariables {
    "--color-ring": string;
    "--tint": string;
}

/**
 * The tokens an accent owns, for one theme.
 *
 * Deliberately two. `--color-primary` is ink and stays ink — it is the fill
 * under "Save", and a ledger whose primary action shouts its accent is the
 * chrome problem this palette work was fixing. `--color-info` is the
 * informational blue and means something the accent does not. The category
 * ramp is anchored on vermilion's hue and does not re-anchor either: those
 * colours are stored per row, so rotating them would repaint every category a
 * user already has, and the accent is chrome where the ramp is taxonomy.
 */
export function accentVariables(accent: Accent, theme: "light" | "dark"): AccentVariables {
    const value = theme === "dark" ? accent.dark : accent.light;
    return { "--color-ring": value, "--tint": value };
}
