/**
 * Every Hugeicon that has to ship as a bitmap, and where it goes.
 *
 * Native chrome never accepts a React element for an icon — a tab item takes an
 * image source because `Icon.src` only unwraps expo-router's own `VectorIcon`, a
 * toolbar item takes an SF Symbol name or an image source, and a SwiftUI swipe
 * action takes an SF Symbol or a pure-SwiftUI label. Hugeicons is SVG, so any
 * glyph that lands in one of those has to be rasterized first.
 *
 * Adding a glyph is a line in `SETS` and a re-run of `pnpm gen:icons`.
 */

import type { IconWeight } from "./hugeicon-raster";

export interface IconEntry {
	/** Export name in `@hugeicons-pro/core-<weight>-rounded`. */
	icon: string;
	/** Points. Defaults to the set's size. */
	size?: number;
	/** Output basename, and the key its consumer imports it by. */
	slug: string;
	/** Overrides the width derived from the set's stroke. */
	strokeWidth?: number;
	/** Defaults to the set's weight. */
	weight?: IconWeight;
	/** Also writes `<slug>-selected` from the solid weight, for on/off pairs. */
	withSelected?: boolean;
}

export interface IconSet {
	/** Why these have to be bitmaps at all — kept next to the set it explains. */
	because: string;
	/** Output directory, `assets/<dir>`. Also the name `gen:icons` filters on. */
	dir: string;
	entries: IconEntry[];
	/**
	 * Colour baked into the pixels. Only matters for a consumer that draws the
	 * bitmap as-is rather than templating it — see `DEFAULT_INK`.
	 */
	ink?: string;
	/** Points every entry renders at unless it overrides. */
	size: number;
	/**
	 * Stroke width at the set's `size`, scaled proportionally for entries that
	 * render smaller. Omit to keep the 1.5 the package bakes in.
	 */
	stroke?: number;
	/** Defaults to stroke. */
	weight?: IconWeight;
}

/** Points. Swift's `LogView.menuIconSize` for a row inside a menu. */
const MENU_SIZE = 17;

export const SETS: IconSet[] = [
	{
		because:
			"`Icon.src` only unwraps expo-router's `VectorIcon` and `PromiseIcon`; any other React element is dropped with a console warning and the tab renders bare.",
		dir: "tab-icons",
		entries: [
			{ icon: "TransactionHistoryIcon", slug: "log", withSelected: true },
			{ icon: "Analytics01Icon", slug: "insights", withSelected: true },
			{ icon: "ProgressIcon", slug: "budgets", withSelected: true },
			{ icon: "Settings01Icon", slug: "settings", withSelected: true },
		],
		size: 24,
	},
	{
		because: "A native toolbar item takes an SF Symbol name or an image source, never a React element.",
		dir: "toolbar-icons",
		entries: [
			{ icon: "PlusSignIcon", slug: "add" },
			{ icon: "Cancel01Icon", slug: "close" },
			{ icon: "Delete02Icon", slug: "delete" },
			{ icon: "Tick02Icon", slug: "done" },
			{ icon: "Search01Icon", slug: "search" },
			{ icon: "Calendar03Icon", slug: "period" },
			{ icon: "ArrowUpDownIcon", slug: "reorder" },
			{ icon: "MoreVerticalSquare01Icon", slug: "more" },
			// Swift reads the eye as the state you get by tapping, not the state you
			// are in: suggestions on shows the crossed-out eye, because tapping hides
			// them.
			{ icon: "ViewOffSlashIcon", slug: "suggestions-on" },
			{ icon: "ViewIcon", slug: "suggestions-off" },
			// The filter button swaps weight rather than glyph while a filter is on.
			{ icon: "FilterHorizontalIcon", slug: "filter" },
			{ icon: "FilterHorizontalIcon", slug: "filter-active", weight: "solid" },

			// One per `LogFilter`, matching Swift's `FilterType.iconNames`. Swift's
			// month row settled for calendar-04 because the bundled font shipped
			// calendar-03 without a ligature; drawing from SVG has no such gap, so
			// month gets the glyph it was always meant to have.
			{ icon: "Invoice01Icon", size: MENU_SIZE, slug: "show-all" },
			{
				icon: "ArrowDataTransferVerticalIcon",
				size: MENU_SIZE,
				slug: "show-type",
			},
			{ icon: "Calendar01Icon", size: MENU_SIZE, slug: "show-day" },
			{ icon: "Calendar02Icon", size: MENU_SIZE, slug: "show-week" },
			{ icon: "Calendar03Icon", size: MENU_SIZE, slug: "show-month" },
			{ icon: "TagsIcon", size: MENU_SIZE, slug: "show-category" },
			{ icon: "RepeatIcon", size: MENU_SIZE, slug: "show-recurring" },
			{ icon: "Clock01Icon", size: MENU_SIZE, slug: "show-upcoming" },
		],
		// Points. What Swift's `ToolbarIcon` defaults to for a toolbar button.
		size: 22,
		// A bare 1.5 line looks thin beside the SF Symbols the OS draws in the same
		// bar. Scaled down for menu rows, which are smaller to begin with.
		stroke: 2,
	},
];
