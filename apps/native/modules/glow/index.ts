import { requireNativeModule } from "expo";

interface GlowNativeModule {
	fromEmoji: (emoji: string) => string[];
	fromImage: (uri: string) => Promise<string[]>;
}

let native: GlowNativeModule | null = null;
try {
	native = requireNativeModule<GlowNativeModule>("Glow");
} catch {
	native = null;
}

const emojiCache = new Map<string, string[]>();

/**
 * Up-to-two dominant hues (`#RRGGBB`) of an emoji glyph, extracted natively by
 * rendering the glyph and histogramming its colors — the Swift `EmojiGlow`
 * algorithm. Synchronous (a glyph render is cheap) and memoized per glyph.
 * Returns `[]` if the native module is unavailable.
 */
export function glowFromEmoji(emoji: string): string[] {
	const hit = emojiCache.get(emoji);
	if (hit) {
		return hit;
	}
	let result: string[] = [];
	if (native) {
		try {
			result = native.fromEmoji(emoji);
		} catch {
			result = [];
		}
	}
	emojiCache.set(emoji, result);
	return result;
}

/**
 * Up-to-two dominant hues (`#RRGGBB`) of an image, extracted natively by
 * decoding it into the same buffer the glyph path uses and running the same
 * histogram. Async because decoding a file off disk shouldn't block JS —
 * call it once when a photo is picked and store the result. Resolves to `[]`
 * if the native module is unavailable or the image can't be read.
 */
export async function glowFromImage(uri: string): Promise<string[]> {
	if (!native) {
		return [];
	}
	try {
		return await native.fromImage(uri);
	} catch {
		return [];
	}
}
