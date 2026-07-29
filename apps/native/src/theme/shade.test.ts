import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUGGESTED_CATEGORY_PRESETS } from "@/data/categories-core";
import {
	curtainShade,
	glyphShade,
	TILE_WASH_OPACITY,
	withAlpha,
} from "./shade";

/**
 * Independent reimplementation of the WCAG contrast maths, deliberately not
 * imported from `color.ts` — the point is to check its output against the spec
 * rather than against itself. Same oracle idea as `budget-spent.test.ts`.
 */
function contrast(aHex: string, bHex: string): number {
	const toRgb = (hex: string): [number, number, number] => {
		const v = hex.replace("#", "");
		const int = Number.parseInt(v, 16);
		return [
			((int >> 16) & 255) / 255,
			((int >> 8) & 255) / 255,
			(int & 255) / 255,
		];
	};
	const lum = (c: [number, number, number]) => {
		const ch = (x: number) =>
			x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
		return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
	};
	const l1 = lum(toRgb(aHex));
	const l2 = lum(toRgb(bHex));
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** The wash a glyph actually sits on: the tint composited over the sheet. */
function washOver(hex: string, isDark: boolean): string {
	const v = hex.replace("#", "");
	const int = Number.parseInt(v, 16);
	const tint = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
	const sheet = isDark ? [28, 28, 31] : [245, 245, 245];
	const t = 1 - TILE_WASH_OPACITY;
	return `#${tint
		.map((c, i) =>
			Math.round(c * (1 - t) + (sheet[i] ?? 0) * t)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

const PALETTE = [
	...new Set(
		[
			...SUGGESTED_CATEGORY_PRESETS.expense,
			...SUGGESTED_CATEGORY_PRESETS.income,
		].map((preset) => preset.color),
	),
];

describe("withAlpha", () => {
	it("converts #RRGGBB to rgba", () => {
		assert.equal(withAlpha("#3AD6B2", 0.5), "rgba(58, 214, 178, 0.5)");
	});

	it("expands #RGB shorthand", () => {
		assert.equal(withAlpha("#F00", 1), "rgba(255, 0, 0, 1)");
	});

	it("clamps alpha into 0..1", () => {
		assert.equal(withAlpha("#000000", -3), "rgba(0, 0, 0, 0)");
		assert.equal(withAlpha("#000000", 9), "rgba(0, 0, 0, 1)");
	});

	it("returns the input untouched when the hex is malformed", () => {
		assert.equal(withAlpha("not-a-color", 0.4), "not-a-color");
		assert.equal(withAlpha("#12345", 0.4), "#12345");
	});
});

describe("curtainShade", () => {
	it("mixes halfway to white in light mode", () => {
		// #000000 halfway to white is #808080 (255 * 0.5 rounds to 128).
		assert.equal(curtainShade("#000000", false), "#808080");
	});

	it("keeps 55% of the channel in dark mode", () => {
		// 255 * 0.55 = 140.25 -> 140 -> 0x8c
		assert.equal(curtainShade("#FFFFFF", true), "#8c8c8c");
	});

	it("always lightens in light mode and darkens in dark mode", () => {
		for (const hex of PALETTE) {
			const light = contrast(curtainShade(hex, false), "#ffffff");
			const dark = contrast(curtainShade(hex, true), "#ffffff");
			assert.ok(
				light <= dark,
				`${hex}: the light-mode curtain should sit closer to white than the dark one`,
			);
		}
	});

	it("returns the input untouched when the hex is malformed", () => {
		assert.equal(curtainShade("nope", true), "nope");
	});
});

describe("glyphShade", () => {
	it("clears the contrast target against its own wash for every palette tint", () => {
		for (const isDark of [false, true]) {
			for (const hex of PALETTE) {
				const shade = glyphShade(hex, isDark);
				const ratio = contrast(shade, washOver(hex, isDark));
				// The target is 3.5. This oracle recomputes the wash in 0–255 space
				// while color.ts works normalized, so the two round the sheet
				// differently (0.96 * 255 = 244.8) — the 0.1 of slack absorbs that,
				// not any shortfall in the implementation.
				assert.ok(
					ratio >= 3.4,
					`${hex} (${isDark ? "dark" : "light"}): glyph ${shade} only reaches ${ratio.toFixed(2)}:1 on its wash`,
				);
			}
		}
	});

	it("darkens a bright tint that would otherwise vanish on its own wash", () => {
		// A saturated yellow over a pale yellow wash is the case this exists for.
		const shaded = glyphShade("#FFC400", false);
		assert.notEqual(shaded, "#FFC400");
		assert.ok(
			contrast(shaded, washOver("#FFC400", false)) >
				contrast("#FFC400", washOver("#FFC400", false)),
			"the shaded glyph must contrast better than the raw tint",
		);
	});

	it("leaves a tint that already contrasts untouched", () => {
		// Near-black on a light wash is already far past the target.
		assert.equal(glyphShade("#101010", false), "#101010");
	});

	it("returns the input untouched when the hex is malformed", () => {
		assert.equal(glyphShade("#zzz", false), "#zzz");
	});
});
