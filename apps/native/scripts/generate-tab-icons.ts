/**
 * Generates the bottom tab bar icons. Run after changing TABS and commit the PNGs:
 * `pnpm --filter @outlayr/native gen:tab-icons`. Needs `brew install librsvg`.
 *
 * They have to be images because `Icon.src` only unwraps expo-router's own
 * `VectorIcon` (an icon font) and `PromiseIcon` — any other React element is
 * dropped with a console warning and the tab renders bare. Hugeicons is SVG.
 */

import { dirname, join, resolve } from "node:path";

import {
	loadIcon,
	rasterize,
	requireRsvgConvert,
	resetDirectory,
	SCALE_COUNT,
	toSvg,
} from "./hugeicon-raster";

const TABS = [
	{ slug: "log", icon: "TransactionHistoryIcon" },
	{ slug: "insights", icon: "Analytics01Icon" },
	{ slug: "budgets", icon: "ProgressIcon" },
	{ slug: "settings", icon: "Settings01Icon" },
] as const;

/** Points. Same size expo-router hands `VectorIcon.getImageSource`. */
const SIZE = 24;

const appDir = resolve(dirname(process.argv[1]), "..");
const outDir = join(appDir, "assets", "tab-icons");

async function main() {
	requireRsvgConvert();
	resetDirectory(outDir);

	for (const { slug, icon } of TABS) {
		const [stroke, solid] = await Promise.all([
			loadIcon("stroke", icon),
			loadIcon("solid", icon),
		]);

		rasterize(toSvg(stroke), join(outDir, slug), SIZE);
		rasterize(toSvg(solid), join(outDir, `${slug}-selected`), SIZE);

		console.log(`${slug} ← ${icon} (stroke + solid)`);
	}

	const written = TABS.length * 2 * SCALE_COUNT;
	console.log(`\nWrote ${written} PNGs to assets/tab-icons`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
