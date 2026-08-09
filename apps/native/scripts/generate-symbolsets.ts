/**
 * Turns Hugeicons SVG data into `.symbolset` bundles — custom SF Symbols. Run
 * after changing `SYMBOLS` and commit the output:
 * `pnpm --filter @outlayr/native gen:symbolsets`.
 *
 * A rasterized PNG cannot reach every native surface. SwiftUI's swipe actions
 * are the case that forced this: `@expo/ui`'s `Image` runs its modifiers through
 * a switch that implements `resizable` alone, so a bitmap there cannot be given
 * a `frame` and grows until the label clips it, and `ImageView.swift` never
 * calls `.renderingMode(.template)` so it cannot take the lane's tint either.
 *
 * A symbol has neither problem: `Image(assetName)` is a real SF Symbol, so it
 * tints with `foregroundStyle`, scales with Dynamic Type, and sits in any slot
 * that accepts a system symbol.
 *
 * The template geometry is Apple's, read out of the templates SF Symbols.app
 * ships in its own bundle rather than guessed.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { type IconWeight, loadIcon, type SvgElement } from "./hugeicon-raster";

interface Symbol {
	/** Export name in `@hugeicons-pro/core-<weight>-rounded`. */
	icon: string;
	/** Asset catalog name — what `Image assetName` asks for. */
	slug: string;
	weight?: IconWeight;
}

const SYMBOLS: Symbol[] = [
	{ icon: "StarIcon", slug: "favourite", weight: "solid" },
	{ icon: "StarOffIcon", slug: "unfavourite", weight: "solid" },
];

/**
 * Apple's template canvas, taken from the SVGs in
 * `/Applications/SF Symbols.app/Contents/Resources`.
 *
 * A slot's own origin sits on its baseline, so a glyph is drawn in NEGATIVE y —
 * upward from the baseline toward the capline.
 */
const CANVAS = { height: 2200, width: 3300 };

/**
 * One row per size. `actool` rejects a template that lacks Regular-M outright —
 * "must have a glyph for Regular weight Medium size" — so the M row is the one
 * that is actually required, not the S row Apple's own badge assets ship.
 * Every row has the same 70.459 cap height, so one scale serves all nine slots.
 */
const ROWS = [
	{ baseline: 696, capline: 625.541, size: "S" },
	{ baseline: 1126, capline: 1055.54, size: "M" },
	{ baseline: 1556, capline: 1485.54, size: "L" },
] as const;

/**
 * Xcode interpolates the weights between these three, so a single-weight source
 * like Hugeicons yields a symbol that does not thin out or thicken with the font
 * weight — correct, just constant.
 */
const WEIGHTS = [
	{ name: "Ultralight", x: 507.128 },
	{ name: "Regular", x: 1394.4 },
	{ name: "Black", x: 2873.15 },
] as const;

const CAP_HEIGHT = ROWS[0].baseline - ROWS[0].capline;

/** Hugeicons draws every glyph on a 24×24 grid. */
const GRID = 24;
const SCALE = CAP_HEIGHT / GRID;

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function attributeName(key: string): string {
	return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Serializes the glyph into one weight slot. The transform maps the 24×24 grid
 * onto the cap height and lifts it so the glyph's bottom edge lands on the
 * baseline; `fill` is dropped to black because a template carries shape only.
 */
function slotContents(elements: SvgElement[]): string {
	return elements
		.map(([tag, attributes]) => {
			const serialized = Object.entries(attributes)
				.filter(([key]) => key !== "key")
				.map(([key, value]) => {
					const resolved = value.replace("currentColor", "#000000");
					return `${attributeName(key)}="${escapeAttribute(resolved)}"`;
				})
				.join(" ");
			return `<${tag} ${serialized} />`;
		})
		.join("");
}

function template(elements: SvgElement[]): string {
	const glyph = slotContents(elements);

	const guides = ROWS.flatMap((row) => [
		`  <line id="Baseline-${row.size}" x1="263" x2="3036" y1="${row.baseline}" y2="${row.baseline}" style="fill:none;stroke:#27AAE1;opacity:1;stroke-width:0.5;"/>`,
		`  <line id="Capline-${row.size}" x1="263" x2="3036" y1="${row.capline}" y2="${row.capline}" style="fill:none;stroke:#27AAE1;opacity:1;stroke-width:0.5;"/>`,
	]).join("\n");

	const slots = ROWS.flatMap((row) =>
		WEIGHTS.map(
			(weight) =>
				`  <g id="${weight.name}-${row.size}" transform="matrix(1 0 0 1 ${weight.x} ${row.baseline})">` +
				`<g transform="scale(${SCALE}) translate(0 -${GRID})">${glyph}</g>` +
				"</g>"
		)
	).join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">
 <g id="Notes"></g>
 <g id="Guides">
${guides}
 </g>
 <g id="Symbols">
${slots}
 </g>
</svg>
`;
}

const CONTENTS = (file: string) =>
	`${JSON.stringify(
		{
			info: { author: "xcode", version: 1 },
			symbols: [{ filename: file, idiom: "universal" }],
		},
		null,
		2
	)}\n`;

const appDir = resolve(dirname(process.argv[1]), "..");
const outDir = join(appDir, "assets", "symbols");

async function main() {
	rmSync(outDir, { force: true, recursive: true });
	mkdirSync(outDir, { recursive: true });

	const loaded = await Promise.all(
		SYMBOLS.map(async (symbol) => ({ elements: await loadIcon(symbol.weight ?? "stroke", symbol.icon), symbol }))
	);

	for (const { elements, symbol } of loaded) {
		const bundle = join(outDir, `${symbol.slug}.symbolset`);
		const file = `${symbol.slug}.svg`;

		mkdirSync(bundle, { recursive: true });
		writeFileSync(join(bundle, file), template(elements));
		writeFileSync(join(bundle, "Contents.json"), CONTENTS(file));

		console.log(`${symbol.slug}.symbolset ← ${symbol.icon}`);
	}

	console.log(`\nWrote ${SYMBOLS.length} symbol sets to assets/symbols`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
