/** WCAG 2.2 AA, normal text. */
export const AA_TEXT_CONTRAST = 4.5;

/**
 * WCAG 2.2 AA, large text and non-text. Large means >=24px, or >=18.66px at
 * weight 700 — `font-sans-semibold` is 600 and does not reach it, so nothing in
 * this app's type scale earns this floor for text.
 */
export const AA_LARGE_CONTRAST = 3;

const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

/**
 * WCAG 2.x relative luminance of a `#RRGGBB` hex.
 *
 * Throws on anything else rather than falling back: the caller is a guard, and a
 * value it cannot measure must not read as a pass. `shade.ts` holds its own copy
 * of this curve because it works in normalized triples mid-bisection; this one
 * takes the strings a stylesheet declares.
 */
export function relativeLuminance(hex: string): number {
	const value = hex.trim().replace(/^#/, "");
	if (!/^[0-9a-f]{6}$/i.test(value)) {
		throw new Error(`not a #RRGGBB hex: ${hex}`);
	}
	const int = Number.parseInt(value, 16);
	const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
	return channels.reduce((sum, channel, index) => {
		const v = channel / 255;
		const linear = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		return sum + CHANNEL_WEIGHTS[index] * linear;
	}, 0);
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` hexes, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
	const first = relativeLuminance(a);
	const second = relativeLuminance(b);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
