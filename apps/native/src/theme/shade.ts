/**
 * Converts a `#RRGGBB` (or `#RGB`) hex to an `rgba()` string at the given alpha.
 * Falls back to the raw input on a malformed hex.
 */
export function withAlpha(hex: string, alpha: number): string {
    const parsed = parseHex(hex);
    if (!parsed) {
        return hex;
    }
    const clamped = Math.max(0, Math.min(1, alpha));
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamped})`;
}

/**
 * Pastelizes a tint the way the Swift `CategoryTileShading.curtain` does.
 * Returns `#RRGGBB`; falls back to the input on a malformed hex.
 */
function byteToHex(v: number): string {
    return Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0");
}

export function curtainShade(hex: string, isDark: boolean): string {
    const parsed = parseHex(hex);
    if (!parsed) {
        return hex;
    }
    const mix = (channel: number) => (isDark ? channel * 0.55 : channel * 0.5 + 255 * 0.5);
    return `#${byteToHex(mix(parsed.r))}${byteToHex(mix(parsed.g))}${byteToHex(mix(parsed.b))}`;
}

/** `CategoryTileShading.washOpacity` — the tint's alpha behind a category glyph. */
export const TILE_WASH_OPACITY = 0.22;
/** `CategoryTileShading.targetContrast` — WCAG graphics minimum, with headroom. */
const TARGET_CONTRAST = 3.5;

/** Normalized sRGB triple, each channel 0–1. */
type Rgb = readonly [number, number, number];

/**
 * `--background` in each theme, normalized. Restated here rather than read from
 * `useColors` because this runs mid-bisection on a worklet-free hot path and
 * takes no hook; `token-contrast.test.ts` is what keeps the pair honest.
 */
const PAPER_GROUND: Rgb = [0.949, 0.941, 0.918];
const DARK_GROUND: Rgb = [0.09, 0.082, 0.059];

/**
 * Derives a legible glyph shade from any category tint, porting Swift's
 * `CategoryTileShading.glyph`. The tint is composited over the sheet at
 * {@link TILE_WASH_OPACITY} to get the wash the glyph actually sits on, then
 * shaded toward ink (or paper, whichever contrasts more) by the smallest amount
 * that clears {@link TARGET_CONTRAST} — found by bisection, exactly as Swift does.
 *
 * A tint that already clears the target is returned untouched.
 */
export function glyphShade(hex: string, isDark: boolean): string {
    const parsed = parseHex(hex);
    if (!parsed) {
        return hex;
    }
    const tint: Rgb = [parsed.r / 255, parsed.g / 255, parsed.b / 255];
    // The theme's own grounds, not the iOS greys these used to approximate: a
    // wash composited over the wrong sheet targets a contrast the tile never
    // actually has.
    const sheet: Rgb = isDark ? DARK_GROUND : PAPER_GROUND;
    const wash = mixRgb(tint, sheet, 1 - TILE_WASH_OPACITY);

    if (contrastRatio(tint, wash) >= TARGET_CONTRAST) {
        return hex;
    }

    const ink: Rgb = DARK_GROUND;
    const paper: Rgb = PAPER_GROUND;
    const anchor = contrastRatio(ink, wash) >= contrastRatio(paper, wash) ? ink : paper;

    let lo = 0;
    let hi = 1;
    for (let index = 0; index < 10; index += 1) {
        const mid = (lo + hi) / 2;
        if (contrastRatio(mixRgb(tint, anchor, mid), wash) >= TARGET_CONTRAST) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    const shaded = mixRgb(tint, anchor, hi);
    return rgbToHex(contrastRatio(shaded, wash) >= TARGET_CONTRAST ? shaded : anchor);
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}

function linearChannel(v: number): number {
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(c: Rgb): number {
    return 0.2126 * linearChannel(c[0]) + 0.7152 * linearChannel(c[1]) + 0.0722 * linearChannel(c[2]);
}

function contrastRatio(a: Rgb, b: Rgb): number {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function unitToHex(v: number): string {
    return Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, "0");
}

function rgbToHex(c: Rgb): string {
    return `#${unitToHex(c[0])}${unitToHex(c[1])}${unitToHex(c[2])}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
    let value = hex.replace("#", "").trim();
    if (value.length === 3) {
        value = [...value].map((c) => c + c).join("");
    }
    if (value.length !== 6) {
        return null;
    }
    const int = Number.parseInt(value, 16);
    if (Number.isNaN(int)) {
        return null;
    }
    return {
        // oxlint-disable-next-line no-bitwise -- `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
        b: int & 255,
        // oxlint-disable-next-line no-bitwise -- `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
        g: (int >> 8) & 255,
        // oxlint-disable-next-line no-bitwise -- `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
        r: (int >> 16) & 255,
    };
}
