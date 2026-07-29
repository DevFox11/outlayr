/**
 * Generates the header/toolbar icons. Run after changing ICONS and commit the
 * PNGs: `pnpm --filter @outlayr/native gen:toolbar-icons`. Needs
 * `brew install librsvg`.
 *
 * A native toolbar item takes an SF Symbol name or an image source — never a
 * React element — so a Hugeicon can only reach it as a bitmap. Every slug here
 * has a matching entry in `src/components/toolbar-icons.ts`.
 *
 * The Hugeicons names mirror Swift's `ToolbarIcon(...)` call sites and
 * `FilterType.iconNames`, so both apps draw the same glyph in the same place.
 */

import { dirname, join, resolve } from "node:path";

import {
	type IconWeight,
	loadIcon,
	rasterize,
	requireRsvgConvert,
	resetDirectory,
	SCALE_COUNT,
	toSvg,
} from "./hugeicon-raster";

/** Points. What Swift's `ToolbarIcon` defaults to for a toolbar button. */
const BUTTON_SIZE = 22;

/** Points. Swift's `LogView.menuIconSize` for a row inside a menu. */
const MENU_SIZE = 17;

/**
 * A bare 1.5 line looks thin beside the SF Symbols the OS draws in the same
 * bar. Scaled down for menu rows, which are smaller to begin with.
 */
const BUTTON_STROKE = 2;

interface ToolbarIcon {
	slug: string;
	icon: string;
	weight?: IconWeight;
	size?: number;
	strokeWidth?: number;
}

const ICONS: ToolbarIcon[] = [
	{ slug: "add", icon: "PlusSignIcon" },
	{ slug: "close", icon: "Cancel01Icon" },
	{ slug: "delete", icon: "Delete02Icon" },
	{ slug: "done", icon: "Tick02Icon" },
	{ slug: "search", icon: "Search01Icon" },
	{ slug: "period", icon: "Calendar03Icon" },
	{ slug: "reorder", icon: "ArrowUpDownIcon" },
	{ slug: "more", icon: "MoreVerticalSquare01Icon" },
	// Swift reads the eye as the state you get by tapping, not the state you are
	// in: suggestions on shows the crossed-out eye, because tapping hides them.
	{ slug: "suggestions-on", icon: "ViewOffSlashIcon" },
	{ slug: "suggestions-off", icon: "ViewIcon" },
	// The filter button swaps weight rather than glyph while a filter is on.
	{ slug: "filter", icon: "FilterHorizontalIcon" },
	{ slug: "filter-active", icon: "FilterHorizontalIcon", weight: "solid" },

	// One per `LogFilter`, matching Swift's `FilterType.iconNames`. Swift's month
	// row settled for calendar-04 because the bundled font shipped calendar-03
	// without a ligature; drawing from SVG has no such gap, so month gets the
	// glyph it was always meant to have.
	{ slug: "show-all", icon: "Invoice01Icon", size: MENU_SIZE },
	{ slug: "show-type", icon: "ArrowDataTransferVerticalIcon", size: MENU_SIZE },
	{ slug: "show-day", icon: "Calendar01Icon", size: MENU_SIZE },
	{ slug: "show-week", icon: "Calendar02Icon", size: MENU_SIZE },
	{ slug: "show-month", icon: "Calendar03Icon", size: MENU_SIZE },
	{ slug: "show-category", icon: "TagsIcon", size: MENU_SIZE },
	{ slug: "show-recurring", icon: "RepeatIcon", size: MENU_SIZE },
	{ slug: "show-upcoming", icon: "Clock01Icon", size: MENU_SIZE },
];

const appDir = resolve(dirname(process.argv[1]), "..");
const outDir = join(appDir, "assets", "toolbar-icons");

async function main() {
	requireRsvgConvert();
	resetDirectory(outDir);

	for (const entry of ICONS) {
		const weight = entry.weight ?? "stroke";
		const size = entry.size ?? BUTTON_SIZE;
		const elements = await loadIcon(weight, entry.icon);
		const strokeWidth =
			weight === "solid"
				? undefined
				: (entry.strokeWidth ?? (BUTTON_STROKE * size) / BUTTON_SIZE);

		rasterize(toSvg(elements, strokeWidth), join(outDir, entry.slug), size);

		console.log(`${entry.slug} ← ${entry.icon} (${weight}, ${size}pt)`);
	}

	console.log(
		`\nWrote ${ICONS.length * SCALE_COUNT} PNGs to assets/toolbar-icons`,
	);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
