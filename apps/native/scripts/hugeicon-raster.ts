/**
 * Turns Hugeicons SVG data into the PNGs the native chrome needs. Neither the
 * tab bar nor the toolbar accepts a React element for an icon — both take an
 * image source — so every glyph that sits in OS chrome has to ship as a bitmap.
 *
 * Needs `brew install librsvg`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

export type SvgElement = [string, Record<string, string>];

export type IconWeight = "stroke" | "solid";

/** Hugeicons draws every glyph on this grid, whatever size it is rendered at. */
const VIEWBOX = 24;

const SCALES = [1, 2, 3];

/**
 * `renderingMode="template"` keeps only the alpha, so for a consumer that
 * templates the bitmap the RGB never ships and black is as good as any value.
 *
 * A consumer that does NOT template it draws the pixels as they are — SwiftUI's
 * `Image.uiImage` is one — so those sets have to bake the colour they need.
 */
export const DEFAULT_INK = "#000000";

function attributeName(key: string): string {
	return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Serializes one weight's element list into an SVG document.
 *
 * `strokeWidth` overrides the 1.5 the package bakes into every stroke glyph,
 * for the surfaces that need a heavier line to sit next to SF Symbols. It is
 * meaningless for the solid weight, which is filled rather than stroked.
 *
 * `ink` is the colour baked into the pixels — see {@link DEFAULT_INK}.
 */
export function toSvg(elements: SvgElement[], strokeWidth?: number, ink: string = DEFAULT_INK): string {
	const shapes = elements
		.map(([tag, attributes]) => {
			const serialized = Object.entries(attributes)
				.filter(([key]) => key !== "key")
				.map(([key, value]) => {
					const resolved =
						key === "strokeWidth" && strokeWidth !== undefined
							? String(strokeWidth)
							: value.replace("currentColor", ink);
					return `${attributeName(key)}="${escapeAttribute(resolved)}"`;
				})
				.join(" ");
			return `<${tag} ${serialized} />`;
		})
		.join("");

	// Without `fill="none"` the stroke weight rasterizes as a solid blob.
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" fill="none">${shapes}</svg>`;
}

/**
 * Writes `basePath.png`, `basePath@2x.png` and `basePath@3x.png`. `points` is
 * the size the glyph should occupy on screen — a bitmap has no intrinsic scale,
 * so this is what decides how large the icon draws.
 */
export function rasterize(svg: string, basePath: string, points: number) {
	for (const scale of SCALES) {
		const pixels = String(points * scale);
		const suffix = scale === 1 ? "" : `@${scale}x`;
		execFileSync("rsvg-convert", ["-w", pixels, "-h", pixels, "-o", `${basePath}${suffix}.png`], { input: svg });
	}
}

export async function loadIcon(weight: IconWeight, name: string): Promise<SvgElement[]> {
	const module = await import(`@hugeicons-pro/core-${weight}-rounded/${name}`);
	const elements = module.default as SvgElement[] | undefined;
	if (!Array.isArray(elements)) {
		throw new Error(`@hugeicons-pro/core-${weight}-rounded/${name} has no icon data`);
	}
	return elements;
}

export function requireRsvgConvert() {
	try {
		execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
	} catch (error) {
		throw new Error("rsvg-convert not found on PATH — install it with `brew install librsvg`", { cause: error });
	}
}

/** Empties the output directory so a renamed icon leaves no orphan PNG behind. */
export function resetDirectory(directory: string) {
	if (existsSync(directory)) {
		rmSync(directory, { recursive: true });
	}
	mkdirSync(directory, { recursive: true });
}

export const SCALE_COUNT = SCALES.length;
