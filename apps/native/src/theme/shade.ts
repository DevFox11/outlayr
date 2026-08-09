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
export function curtainShade(hex: string, isDark: boolean): string {
	const parsed = parseHex(hex);
	if (!parsed) {
		return hex;
	}
	const mix = (channel: number) => (isDark ? channel * 0.55 : channel * 0.5 + 255 * 0.5);
	const to = (v: number) =>
		Math.round(Math.max(0, Math.min(255, v)))
			.toString(16)
			.padStart(2, "0");
	return `#${to(mix(parsed.r))}${to(mix(parsed.g))}${to(mix(parsed.b))}`;
}

/** `CategoryTileShading.washOpacity` — the tint's alpha behind a category glyph. */
export const TILE_WASH_OPACITY = 0.22;
/** `CategoryTileShading.targetContrast` — WCAG graphics minimum, with headroom. */
const TARGET_CONTRAST = 3.5;

/** Normalized sRGB triple, each channel 0–1. */
type Rgb = readonly [number, number, number];

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
	const sheet: Rgb = isDark ? [0.11, 0.11, 0.12] : [0.96, 0.96, 0.96];
	const wash = mixRgb(tint, sheet, 1 - TILE_WASH_OPACITY);

	if (contrastRatio(tint, wash) >= TARGET_CONTRAST) {
		return hex;
	}

	const ink: Rgb = [0.09, 0.09, 0.1];
	const paper: Rgb = [0.99, 0.99, 0.99];
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

function relativeLuminance(c: Rgb): number {
	const channel = (v: number) => (v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

function contrastRatio(a: Rgb, b: Rgb): number {
	const l1 = relativeLuminance(a);
	const l2 = relativeLuminance(b);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToHex(c: Rgb): string {
	const channel = (v: number) =>
		Math.round(Math.max(0, Math.min(1, v)) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${channel(c[0])}${channel(c[1])}${channel(c[2])}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	let value = hex.replace("#", "").trim();
	if (value.length === 3) {
		value = value
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (value.length !== 6) {
		return null;
	}
	const int = Number.parseInt(value, 16);
	if (Number.isNaN(int)) {
		return null;
	}
	return {
		// biome-ignore lint/suspicious/noBitwiseOperators: `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
		b: int & 255,
		// biome-ignore lint/suspicious/noBitwiseOperators: `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
		g: (int >> 8) & 255,
		// biome-ignore lint/suspicious/noBitwiseOperators: `int` is the hex parsed as one packed 24-bit word; the channels are its bytes
		r: (int >> 16) & 255,
	};
}
