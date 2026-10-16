/*
 * The text/ground pairs the app relies on, by token name without the leading
 * `--`. Shared by the two places that must agree on them: `token-contrast.test.ts`
 * holds the stylesheet's own values to them, and `material-scheme.ts` enforces
 * them on the palette Android derives from the wallpaper at runtime.
 */

/**
 * Every ground either theme paints behind text. Which token lands on which
 * ground is not statically knowable — a screen paints `bg-surface` and a child
 * three levels down writes `text-muted` — so the floor is held against all of
 * them rather than guessed per pair.
 */
export const GROUNDS = ["background", "surface", "surface-secondary", "grouped-background"] as const;

/** Colour tokens that render as text over one of {@link GROUNDS}. */
export const TEXT_TOKENS = [
    "foreground",
    "muted",
    "subtle",
    "grammar",
    "accent",
    "expense",
    "income",
    "future",
    "tint",
    "danger",
    "over-budget",
] as const;

/**
 * Tokens that only ever carry text over the one fill they are named for, never
 * over a page ground: `text-background` and `text-accent-foreground` both appear
 * on `bg-accent`, so measuring either against `--background` would be measuring
 * a pairing the app never draws.
 */
export const INVERSE_TOKENS = {
    "accent-foreground": "accent",
    background: "accent",
    "surface-foreground": "surface",
    "surface-secondary-foreground": "surface-secondary",
} as const satisfies Record<string, string>;

/** The Material 3 surface ladder; every one of them is a ground M3 writes text over. */
export const M3_SURFACES = [
    "m3-surface",
    "m3-surface-container-lowest",
    "m3-surface-container-low",
    "m3-surface-container",
    "m3-surface-container-high",
    "m3-surface-container-highest",
] as const;

/**
 * Each Material 3 text role against the fills M3 pairs it with. The iOS answers
 * are the stylesheet's own values; on Android `material-scheme.ts` enforces
 * these pairs on whatever scheme the device hands it.
 * `m3-primary` and `m3-error` are both a fill and a text colour: text buttons
 * and field errors write them straight onto the surfaces.
 */
export const M3_TEXT_ON = {
    "m3-error": M3_SURFACES,
    "m3-inverse-on-surface": ["m3-inverse-surface"],
    "m3-on-error": ["m3-error"],
    "m3-on-error-container": ["m3-error-container"],
    "m3-on-primary": ["m3-primary"],
    "m3-on-primary-container": ["m3-primary-container"],
    "m3-on-secondary": ["m3-secondary"],
    "m3-on-secondary-container": ["m3-secondary-container"],
    "m3-on-surface": M3_SURFACES,
    "m3-on-surface-variant": M3_SURFACES,
    "m3-on-tertiary": ["m3-tertiary"],
    "m3-on-tertiary-container": ["m3-tertiary-container"],
    "m3-primary": M3_SURFACES,
} as const satisfies Record<string, readonly string[]>;

/**
 * Each first-run text token against the grounds it is actually written over.
 * `--fr-vermilion` is the eyebrow and only the eyebrow — one call site, in the
 * stage layout of `components/first-run.tsx`, over `--fr-ground`. It never
 * enters a `bg-fr-card` box, which holds `--fr-ink` and `--fr-muted` alone, and
 * on dark it would not clear the floor there (4.42:1) if it did.
 */
export const FIRST_RUN_TEXT = {
    "fr-ink": ["fr-ground", "fr-card"],
    "fr-muted": ["fr-ground", "fr-card"],
    "fr-vermilion": ["fr-ground"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Fills that carry literal white text rather than a token. Neither
 * {@link GROUNDS} nor {@link INVERSE_TOKENS} can reach the pairing — white is
 * not a token and the fill is not a ground — so it is named here or it is
 * measured nowhere.
 */
export const WHITE_TEXT_FILLS = ["danger-fill", "gold-fill"] as const;

/**
 * The verdict badges write `--<tone>-on-wash` over a wash of `--<tone>` at this
 * alpha, laid over `--background`.
 */
export const WASH_ALPHA = 0.2;

export const ON_WASH = {
    "danger-on-wash": "danger",
    "income-on-wash": "income",
} as const;
