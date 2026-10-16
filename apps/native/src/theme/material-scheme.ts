import { argbFromHex, Blend, Hct, hexFromArgb } from "@material/material-color-utilities";

import {
    FIRST_RUN_TEXT,
    GROUNDS,
    INVERSE_TOKENS,
    M3_SURFACES,
    M3_TEXT_ON,
    ON_WASH,
    TEXT_TOKENS,
    WASH_ALPHA,
} from "./contrast-pairs";
import { MATERIAL_ROLE_VARIABLES, MATERIAL_ROLES } from "./material-roles";
import type { MaterialRoleColors } from "./material-roles";
import { withAlpha } from "./shade";

/*
 * Android's colour pipeline, minus the platform: a Material 3 scheme in, every
 * colour variable `global.css` declares out, for one theme. Pure so jest can
 * sweep it across wallpapers; `use-accent.android.ts` feeds it the scheme
 * Compose itself uses and writes the result through uniwind.
 */

export type MaterialTheme = "light" | "dark";

/** WCAG 2.2 AA, normal text. */
export const AA_TEXT_CONTRAST = 4.5;

const RGBA_HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const WHITE = "#ffffff";

/**
 * `#RRGGBBAA`, the form `@expo/ui`'s `getMaterialColors` returns, as the
 * lowercase `#rrggbb` the stylesheet and `withAlpha` speak. Every role it
 * returns is opaque, so the alpha byte carries nothing.
 */
export function hexFromRgba(value: string): string {
    const match = RGBA_HEX.exec(value);
    if (!match) {
        throw new Error(`not a #RRGGBB(AA) hex: ${value}`);
    }
    return `#${match[1].toLowerCase()}`;
}

function channels(hex: string): number[] {
    const value = hexFromRgba(hex);
    return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function relativeLuminance(hex: string): number {
    return channels(hex).reduce((sum, channel, index) => {
        const v = channel / 255;
        const linear = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return sum + CHANNEL_WEIGHTS[index] * linear;
    }, 0);
}

export function contrastRatio(a: string, b: string): number {
    const first = relativeLuminance(a);
    const second = relativeLuminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** `top` at `alpha` laid over the opaque `ground`, as an opaque hex. */
export function mixOver(top: string, ground: string, alpha: number): string {
    const [over, under] = [channels(top), channels(ground)];
    return `#${over
        .map((channel, index) =>
            Math.round(alpha * channel + (1 - alpha) * under[index])
                .toString(16)
                .padStart(2, "0")
        )
        .join("")}`;
}

/**
 * `color` with its HCT tone pushed, hue and chroma kept, until it clears
 * `floor` against every one of `grounds`. A colour that already clears comes
 * back untouched. It moves away from the grounds: darker when it is darker
 * than they are on average, lighter otherwise.
 */
export function ensureContrast(color: string, grounds: readonly string[], floor = AA_TEXT_CONTRAST): string {
    const clears = (candidate: string) => grounds.every((ground) => contrastRatio(candidate, ground) >= floor);
    if (clears(color)) {
        return color;
    }
    const groundLuminance = grounds.reduce((sum, ground) => sum + relativeLuminance(ground), 0) / grounds.length;
    const step = relativeLuminance(color) > groundLuminance ? 1 : -1;
    const hct = Hct.fromInt(argbFromHex(color));
    for (let tone = Math.round(hct.tone) + step; tone >= 0 && tone <= 100; tone += step) {
        const candidate = hexFromArgb(Hct.from(hct.hue, hct.chroma, tone).toInt());
        if (clears(candidate)) {
            return candidate;
        }
    }
    return step > 0 ? WHITE : "#000000";
}

/** `brand`'s hue nudged toward `source`'s (at most 15°), so it sits in the palette. */
function harmonize(brand: string, source: string): string {
    return hexFromArgb(Blend.harmonize(argbFromHex(brand), argbFromHex(source)));
}

/** The alpha out of an `rgba(r, g, b, a)` declaration. */
function alphaOf(rgba: string): number {
    const alpha = Number(rgba.slice(rgba.lastIndexOf(",") + 1, rgba.lastIndexOf(")")));
    if (Number.isNaN(alpha)) {
        throw new TypeError(`not an rgba(): ${rgba}`);
    }
    return alpha;
}

/**
 * The brand values the pipeline still starts from: the semantic hues, which
 * are harmonized toward the scheme rather than replaced by it, and the washes,
 * whose alpha is kept and whose colour is not. Transcribed from `global.css`;
 * `material-scheme.test.ts` fails the moment the two disagree. Category colours
 * are not here and never move: they are a user's own identity for a category.
 */
export const BRAND_TOKENS = {
    dark: {
        "color-chart-4": "#de9a59",
        "color-chart-5": "#e78ba4",
        "color-destructive-soft": "rgba(255, 73, 60, 0.06)",
        "color-destructive-subtle": "rgba(255, 73, 60, 0.16)",
        "color-info": "#7bb4dd",
        "color-info-soft": "rgba(123, 180, 221, 0.06)",
        "color-info-subtle": "rgba(123, 180, 221, 0.16)",
        "color-skeleton": "rgba(242, 239, 232, 0.11)",
        "color-success-soft": "rgba(63, 217, 155, 0.06)",
        "color-success-subtle": "rgba(63, 217, 155, 0.16)",
        "color-warning-foreground": "#fdcc41",
        "color-warning-soft": "rgba(253, 204, 65, 0.06)",
        "color-warning-subtle": "rgba(253, 204, 65, 0.16)",
        danger: "#ff493c",
        "danger-fill": "#da0f01",
        "danger-on-wash": "#fe5a4d",
        "gold-fill": "#8a6a14",
        income: "#3fd99b",
        "income-on-wash": "#3fd99b",
        "over-budget": "#f17879",
        "rail-over": "rgba(241, 120, 121, 0.22)",
        "rail-track": "rgba(242, 239, 232, 0.14)",
        transfer: "#65b3ee",
        warning: "#fdcc41",
    },
    light: {
        "color-chart-4": "#ac7137",
        "color-chart-5": "#b4647a",
        "color-destructive-soft": "rgba(192, 16, 5, 0.1)",
        "color-destructive-subtle": "rgba(192, 16, 5, 0.08)",
        "color-info": "#2f6d99",
        "color-info-soft": "rgba(47, 109, 153, 0.1)",
        "color-info-subtle": "rgba(47, 109, 153, 0.08)",
        "color-skeleton": "rgba(23, 21, 15, 0.09)",
        "color-success-soft": "rgba(0, 113, 74, 0.1)",
        "color-success-subtle": "rgba(0, 113, 74, 0.08)",
        "color-warning-foreground": "#826312",
        "color-warning-soft": "rgba(253, 204, 65, 0.1)",
        "color-warning-subtle": "rgba(253, 204, 65, 0.08)",
        danger: "#c01005",
        "danger-fill": "#da0f01",
        "danger-on-wash": "#aa1106",
        "gold-fill": "#8a6a14",
        income: "#00714a",
        "income-on-wash": "#036643",
        "over-budget": "#bd1c1e",
        "rail-over": "rgba(189, 28, 30, 0.2)",
        "rail-track": "rgba(23, 21, 15, 0.13)",
        transfer: "#4187ba",
        warning: "#fdcc41",
    },
} as const satisfies Record<MaterialTheme, Record<string, string>>;

/** Token name (no leading `--`) to value; what {@link materialVariables} builds up. */
type Tokens = Record<string, string>;

/**
 * Clamps each text token in `pairs` against its fills, in place. Tokens that
 * are themselves a fill of another pair go first, so the text written over
 * them is measured against their final value. A token that is a ground is
 * never moved: it is measured, not adjusted, because moving it would move
 * every pair it holds up.
 */
function enforce(tokens: Tokens, pairs: Record<string, readonly string[]>, fixed: ReadonlySet<string>): void {
    const fills = new Set(Object.values(pairs).flat());
    // Not `toSorted`: nothing else in the app relies on Hermes having it.
    const order = Object.keys(pairs).sort((a, b) => Number(!fills.has(a)) - Number(!fills.has(b)));
    for (const text of order) {
        if (!fixed.has(text)) {
            tokens[text] = ensureContrast(
                tokens[text],
                pairs[text].map((fill) => tokens[fill])
            );
        }
    }
}

/** Clamps each verdict badge's text against its own wash, laid over the page ground. */
function enforceWashes(tokens: Tokens): void {
    for (const [text, tone] of Object.entries(ON_WASH)) {
        tokens[text] = ensureContrast(tokens[text], [mixOver(tokens[tone], tokens.background, WASH_ALPHA)]);
    }
}

/**
 * The shared pairs in {@link enforce}'s shape. Text tokens are held against
 * the whole M3 surface ladder as well as the four grounds, because on Android
 * popovers and dialogs paint the higher containers and the same text lands
 * on them.
 *
 * Plus the text PanelUI writes from its own tokens, which the iOS stylesheet
 * was never measured on: held to the same floor here, so a harmonized hue
 * cannot slip under it.
 */
const OUTLAYR_PAIRS = {
    ...Object.fromEntries(
        [...TEXT_TOKENS, "color-info", "color-warning-foreground"].map((token) => [token, [...GROUNDS, ...M3_SURFACES]])
    ),
    ...Object.fromEntries(Object.entries(INVERSE_TOKENS).map(([token, fill]) => [token, [fill]])),
    ...FIRST_RUN_TEXT,
} satisfies Record<string, readonly string[]>;

/** The roles keyed by their CSS names without the leading `--`: `onError` becomes `m3-on-error`. */
function m3Tokens(roles: MaterialRoleColors): Tokens {
    return Object.fromEntries(MATERIAL_ROLES.map((role) => [MATERIAL_ROLE_VARIABLES[role].slice(2), roles[role]]));
}

/** The M3 roles back out of their CSS names, after {@link enforce} moved some. */
function m3Roles(tokens: Tokens): MaterialRoleColors {
    // SAFETY: `fromEntries` loses the key union; one entry per role, read from
    // the names `m3Tokens` wrote.
    return Object.fromEntries(
        MATERIAL_ROLES.map((role) => [role, tokens[MATERIAL_ROLE_VARIABLES[role].slice(2)]])
    ) as MaterialRoleColors;
}

/**
 * Every colour variable `global.css` declares, rebuilt from a Material 3 scheme
 * for one theme. Keys carry the leading `--`, ready for
 * `Uniwind.updateCSSVariables`.
 *
 * - The `--m3-*` roles are the scheme's own, with text roles clamped to 4.5:1
 *   on what M3 pairs them with.
 * - Outlayr's tokens are mapped onto roles: paper becomes `surface`, ink
 *   `onSurface`, raised planes the surface containers, the accent `primary`.
 * - Semantic hues (income, danger, transfer...) are harmonized toward
 *   `primary` and clamped on every ground; fills under literal white text are
 *   clamped against white; washes keep their alpha.
 */
export function materialVariables(scheme: MaterialRoleColors, theme: MaterialTheme): Record<`--${string}`, string> {
    const brand = BRAND_TOKENS[theme];
    const m3Clamped = m3Tokens(scheme);
    enforce(m3Clamped, M3_TEXT_ON, new Set());
    const m3 = m3Roles(m3Clamped);
    const toward = (token: keyof typeof brand) => harmonize(brand[token], m3.primary);

    const tokens = {
        accent: m3.primary,
        "accent-foreground": m3.onPrimary,
        background: m3.surface,
        border: m3.outlineVariant,
        chip: m3.secondaryContainer,
        "color-card": m3.surfaceContainerLow,
        "color-chart-1": m3.primary,
        "color-chart-2": m3.tertiary,
        "color-chart-3": m3.secondary,
        "color-chart-4": toward("color-chart-4"),
        "color-chart-5": toward("color-chart-5"),
        "color-info": toward("color-info"),
        "color-input": m3.outlineVariant,
        "color-muted-foreground": m3.onSurfaceVariant,
        "color-overlay": m3.surfaceContainerHigh,
        "color-popover": m3.surfaceContainer,
        "color-surface-tertiary": m3.surfaceContainerHigh,
        "color-warning-foreground": toward("color-warning-foreground"),
        danger: toward("danger"),
        "danger-fill": ensureContrast(toward("danger-fill"), [WHITE]),
        "danger-on-wash": toward("danger-on-wash"),
        expense: m3.onSurface,
        foreground: m3.onSurface,
        "fr-card": m3.surfaceContainerLow,
        "fr-ground": m3.surface,
        "fr-ink": m3.onSurface,
        "fr-muted": m3.onSurfaceVariant,
        "fr-rule": m3.outlineVariant,
        "fr-vermilion": m3.primary,
        future: m3.onSurfaceVariant,
        "gold-fill": ensureContrast(toward("gold-fill"), [WHITE]),
        // The connector words: the dimmest the floor allows, which is where
        // M3's outline sits once it is lifted to text contrast.
        grammar: m3.outline,
        "grouped-background": m3.surface,
        income: toward("income"),
        "income-on-wash": toward("income-on-wash"),
        muted: m3.onSurfaceVariant,
        "over-budget": toward("over-budget"),
        separator: m3.outlineVariant,
        subtle: m3.onSurfaceVariant,
        surface: m3.surfaceContainerLow,
        "surface-foreground": m3.onSurface,
        "surface-secondary": m3.surfaceContainer,
        "surface-secondary-foreground": m3.onSurface,
        tint: m3.primary,
        transfer: toward("transfer"),
        warning: toward("warning"),
        ...m3Clamped,
    } satisfies Tokens;

    enforce(tokens, OUTLAYR_PAIRS, new Set(GROUNDS));
    enforceWashes(tokens);

    const derived = {
        "color-accent-foreground": tokens["accent-foreground"],
        "color-card-foreground": tokens.foreground,
        "color-destructive": tokens.danger,
        "color-destructive-foreground": tokens.danger,
        "color-destructive-soft": withAlpha(tokens.danger, alphaOf(brand["color-destructive-soft"])),
        "color-destructive-subtle": withAlpha(tokens.danger, alphaOf(brand["color-destructive-subtle"])),
        "color-info-foreground": tokens["color-info"],
        "color-info-soft": withAlpha(tokens["color-info"], alphaOf(brand["color-info-soft"])),
        "color-info-subtle": withAlpha(tokens["color-info"], alphaOf(brand["color-info-subtle"])),
        "color-overlay-foreground": tokens.foreground,
        "color-popover-foreground": tokens.foreground,
        "color-primary": tokens.accent,
        "color-primary-foreground": tokens["accent-foreground"],
        "color-ring": tokens.tint,
        "color-skeleton": withAlpha(tokens.foreground, alphaOf(brand["color-skeleton"])),
        "color-success": tokens.income,
        "color-success-foreground": tokens.income,
        "color-success-soft": withAlpha(tokens.income, alphaOf(brand["color-success-soft"])),
        "color-success-subtle": withAlpha(tokens.income, alphaOf(brand["color-success-subtle"])),
        "color-warning-soft": withAlpha(tokens.warning, alphaOf(brand["color-warning-soft"])),
        "color-warning-subtle": withAlpha(tokens.warning, alphaOf(brand["color-warning-subtle"])),
        "rail-over": withAlpha(tokens["over-budget"], alphaOf(brand["rail-over"])),
        "rail-track": withAlpha(tokens.foreground, alphaOf(brand["rail-track"])),
    } satisfies Tokens;

    // SAFETY: `fromEntries` widens its keys to string; every key is built as
    // `--${name}` on the line above.
    return Object.fromEntries(
        Object.entries({ ...tokens, ...derived }).map(([name, value]) => [`--${name}`, value])
    ) as Record<`--${string}`, string>;
}
