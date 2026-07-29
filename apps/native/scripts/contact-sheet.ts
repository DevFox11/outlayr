/**
 * Renders candidate glyphs at their real on-screen size beside a magnified copy,
 * so an icon is judged at the size it will be read at. Several Settings glyphs
 * looked fine in the picker and turned to mush at 20pt.
 *
 * `node --import tsx scripts/contact-sheet.ts <IconName> [<IconName>…]`
 */

import { execFileSync } from "node:child_process";
import { loadIcon, toSvg } from "./hugeicon-raster";

const REAL = 20;
const BIG = 64;
const GAP = 28;
const LABEL_W = 300;
const ROW = BIG + GAP;

async function main() {
	const names = process.argv.slice(2);
	if (names.length === 0) {
		throw new Error("pass at least one icon name");
	}

	const rows = await Promise.all(
		names.map(async (name) => ({
			name,
			elements: await loadIcon("stroke", name),
		})),
	);

	const height = rows.length * ROW + GAP;
	const width = LABEL_W + BIG + REAL + GAP * 3;

	const parts = rows.map(({ name, elements }, index) => {
		const y = GAP + index * ROW;
		const glyph = toSvg(elements, 1.9)
			.replace(/^<svg[^>]*>/, "")
			.replace("</svg>", "");
		return `
			<text x="${GAP}" y="${y + BIG / 2 + 5}" font-family="ui-monospace, monospace" font-size="15" fill="#111">${name}</text>
			<g transform="translate(${LABEL_W}, ${y}) scale(${BIG / 24})">${glyph}</g>
			<g transform="translate(${LABEL_W + BIG + GAP}, ${y + (BIG - REAL) / 2}) scale(${REAL / 24})">${glyph}</g>`;
	});

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none"><rect width="${width}" height="${height}" fill="#fff"/>${parts.join("")}</svg>`;

	execFileSync(
		"rsvg-convert",
		["-w", String(width * 2), "-o", "/tmp/contact-sheet.png"],
		{
			input: svg,
		},
	);
	console.log(`wrote /tmp/contact-sheet.png — ${rows.length} candidates`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
