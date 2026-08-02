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
	/** Output basename, and the key its consumer imports it by. */
	slug: string;
	/** Export name in `@hugeicons-pro/core-<weight>-rounded`. */
	icon: string;
	/** Defaults to the set's weight. */
	weight?: IconWeight;
	/** Points. Defaults to the set's size. */
	size?: number;
	/** Overrides the width derived from the set's stroke. */
	strokeWidth?: number;
	/** Also writes `<slug>-selected` from the solid weight, for on/off pairs. */
	withSelected?: boolean;
}

export interface IconSet {
	/** Output directory, `assets/<dir>`. Also the name `gen:icons` filters on. */
	dir: string;
	/** Points every entry renders at unless it overrides. */
	size: number;
	/** Defaults to stroke. */
	weight?: IconWeight;
	/**
	 * Stroke width at the set's `size`, scaled proportionally for entries that
	 * render smaller. Omit to keep the 1.5 the package bakes in.
	 */
	stroke?: number;
	/**
	 * Colour baked into the pixels. Only matters for a consumer that draws the
	 * bitmap as-is rather than templating it — see `DEFAULT_INK`.
	 */
	ink?: string;
	/** Why these have to be bitmaps at all — kept next to the set it explains. */
	because: string;
	entries: IconEntry[];
}

/** Points. Swift's `LogView.menuIconSize` for a row inside a menu. */
const MENU_SIZE = 17;

export const SETS: IconSet[] = [
	{
		dir: "tab-icons",
		size: 24,
		because:
			"`Icon.src` only unwraps expo-router's `VectorIcon` and `PromiseIcon`; any other React element is dropped with a console warning and the tab renders bare.",
		entries: [
			{ slug: "log", icon: "TransactionHistoryIcon", withSelected: true },
			{ slug: "insights", icon: "Analytics01Icon", withSelected: true },
			{ slug: "budgets", icon: "ProgressIcon", withSelected: true },
			{ slug: "settings", icon: "Settings01Icon", withSelected: true },
		],
	},
	{
		dir: "toolbar-icons",
		// Points. What Swift's `ToolbarIcon` defaults to for a toolbar button.
		size: 22,
		// A bare 1.5 line looks thin beside the SF Symbols the OS draws in the same
		// bar. Scaled down for menu rows, which are smaller to begin with.
		stroke: 2,
		because:
			"A native toolbar item takes an SF Symbol name or an image source, never a React element.",
		entries: [
			{ slug: "add", icon: "PlusSignIcon" },
			{ slug: "close", icon: "Cancel01Icon" },
			{ slug: "delete", icon: "Delete02Icon" },
			{ slug: "done", icon: "Tick02Icon" },
			{ slug: "search", icon: "Search01Icon" },
			{ slug: "period", icon: "Calendar03Icon" },
			{ slug: "reorder", icon: "ArrowUpDownIcon" },
			{ slug: "more", icon: "MoreVerticalSquare01Icon" },
			// Swift reads the eye as the state you get by tapping, not the state you
			// are in: suggestions on shows the crossed-out eye, because tapping hides
			// them.
			{ slug: "suggestions-on", icon: "ViewOffSlashIcon" },
			{ slug: "suggestions-off", icon: "ViewIcon" },
			// The filter button swaps weight rather than glyph while a filter is on.
			{ slug: "filter", icon: "FilterHorizontalIcon" },
			{ slug: "filter-active", icon: "FilterHorizontalIcon", weight: "solid" },

			// One per `LogFilter`, matching Swift's `FilterType.iconNames`. Swift's
			// month row settled for calendar-04 because the bundled font shipped
			// calendar-03 without a ligature; drawing from SVG has no such gap, so
			// month gets the glyph it was always meant to have.
			{ slug: "show-all", icon: "Invoice01Icon", size: MENU_SIZE },
			{
				slug: "show-type",
				icon: "ArrowDataTransferVerticalIcon",
				size: MENU_SIZE,
			},
			{ slug: "show-day", icon: "Calendar01Icon", size: MENU_SIZE },
			{ slug: "show-week", icon: "Calendar02Icon", size: MENU_SIZE },
			{ slug: "show-month", icon: "Calendar03Icon", size: MENU_SIZE },
			{ slug: "show-category", icon: "TagsIcon", size: MENU_SIZE },
			{ slug: "show-recurring", icon: "RepeatIcon", size: MENU_SIZE },
			{ slug: "show-upcoming", icon: "Clock01Icon", size: MENU_SIZE },
		],
	},
];
