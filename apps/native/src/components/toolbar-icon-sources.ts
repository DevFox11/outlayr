import addIcon from "@/assets/toolbar-icons/add.png";
import closeIcon from "@/assets/toolbar-icons/close.png";
import deleteIcon from "@/assets/toolbar-icons/delete.png";
import doneIcon from "@/assets/toolbar-icons/done.png";
import filterActiveIcon from "@/assets/toolbar-icons/filter-active.png";
import filterIcon from "@/assets/toolbar-icons/filter.png";
import moreIcon from "@/assets/toolbar-icons/more.png";
import periodIcon from "@/assets/toolbar-icons/period.png";
import reorderIcon from "@/assets/toolbar-icons/reorder.png";
import searchIcon from "@/assets/toolbar-icons/search.png";
import showAllIcon from "@/assets/toolbar-icons/show-all.png";
import showCategoryIcon from "@/assets/toolbar-icons/show-category.png";
import showDayIcon from "@/assets/toolbar-icons/show-day.png";
import showMonthIcon from "@/assets/toolbar-icons/show-month.png";
import showRecurringIcon from "@/assets/toolbar-icons/show-recurring.png";
import showTransfersIcon from "@/assets/toolbar-icons/show-transfers.png";
import showTypeIcon from "@/assets/toolbar-icons/show-type.png";
import showUpcomingIcon from "@/assets/toolbar-icons/show-upcoming.png";
import showWeekIcon from "@/assets/toolbar-icons/show-week.png";
import suggestionsOffIcon from "@/assets/toolbar-icons/suggestions-off.png";
import suggestionsOnIcon from "@/assets/toolbar-icons/suggestions-on.png";

/**
 * Rasterized by `scripts/generate-icons.ts` from the `toolbar-icons` set in
 * `scripts/icon-sets.ts`. A toolbar item takes an SF Symbol name or an image
 * source and drops any React element, so a Hugeicon can only reach one as a
 * bitmap. Its own module so `toolbar-icons.ts` and its Android sibling share
 * one map.
 */
export const TOOLBAR_ICON_SOURCES = {
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
    showTransfers: showTransfersIcon,
    showType: showTypeIcon,
    showUpcoming: showUpcomingIcon,
    showWeek: showWeekIcon,
    suggestionsOff: suggestionsOffIcon,
    suggestionsOn: suggestionsOnIcon,
} as const;

export type ToolbarIconName = keyof typeof TOOLBAR_ICON_SOURCES;
