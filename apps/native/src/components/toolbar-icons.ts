import { useImage } from "expo-image";

import addIcon from "@/assets/toolbar-icons/add.png";
import closeIcon from "@/assets/toolbar-icons/close.png";
import deleteIcon from "@/assets/toolbar-icons/delete.png";
import doneIcon from "@/assets/toolbar-icons/done.png";
import filterIcon from "@/assets/toolbar-icons/filter.png";
import filterActiveIcon from "@/assets/toolbar-icons/filter-active.png";
import moreIcon from "@/assets/toolbar-icons/more.png";
import periodIcon from "@/assets/toolbar-icons/period.png";
import reorderIcon from "@/assets/toolbar-icons/reorder.png";
import searchIcon from "@/assets/toolbar-icons/search.png";
import showAllIcon from "@/assets/toolbar-icons/show-all.png";
import showCategoryIcon from "@/assets/toolbar-icons/show-category.png";
import showDayIcon from "@/assets/toolbar-icons/show-day.png";
import showMonthIcon from "@/assets/toolbar-icons/show-month.png";
import showRecurringIcon from "@/assets/toolbar-icons/show-recurring.png";
import showTypeIcon from "@/assets/toolbar-icons/show-type.png";
import showUpcomingIcon from "@/assets/toolbar-icons/show-upcoming.png";
import showWeekIcon from "@/assets/toolbar-icons/show-week.png";
import suggestionsOffIcon from "@/assets/toolbar-icons/suggestions-off.png";
import suggestionsOnIcon from "@/assets/toolbar-icons/suggestions-on.png";

/**
 * Rasterized by `scripts/generate-toolbar-icons.ts`. A toolbar item takes an SF
 * Symbol name or an image source and drops any React element, so a Hugeicon can
 * only reach one as a bitmap.
 */
const SOURCE = {
	add: addIcon,
	close: closeIcon,
	delete: deleteIcon,
	done: doneIcon,
	filter: filterIcon,
	filterActive: filterActiveIcon,
	more: moreIcon,
	period: periodIcon,
	reorder: reorderIcon,
	search: searchIcon,
	showAll: showAllIcon,
	showCategory: showCategoryIcon,
	showDay: showDayIcon,
	showMonth: showMonthIcon,
	showRecurring: showRecurringIcon,
	showType: showTypeIcon,
	showUpcoming: showUpcomingIcon,
	showWeek: showWeekIcon,
	suggestionsOff: suggestionsOffIcon,
	suggestionsOn: suggestionsOnIcon,
} as const;

export type ToolbarIconName = keyof typeof SOURCE;

/**
 * Icon props for a left/right toolbar item. Spread, not passed one prop at a
 * time, so `template` travels with the source — the glyphs are flat black and
 * without it iOS never tints them.
 */
export function toolbarIcon(name: ToolbarIconName) {
	return { icon: SOURCE[name], iconRenderingMode: "template" } as const;
}

/**
 * For a `placement="bottom"` toolbar: iOS ignores an image on `icon` there and
 * reads only `image`, which wants a loaded image rather than a source.
 */
export function useToolbarIcon(name: ToolbarIconName) {
	const image = useImage(SOURCE[name]);
	return { image, iconRenderingMode: "template" } as const;
}
