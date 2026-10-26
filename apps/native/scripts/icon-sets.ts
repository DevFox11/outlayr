export interface IconEntry {
    /** Lucide icon name: the kebab-case file under `lucide-react-native/icons`. */
    icon: string;
    slug: string;
    withSelected?: boolean;
    ink?: string;
    stroke?: number;
}

export interface IconSet {
    because: string;
    dir: string;
    entries: IconEntry[];
    stroke?: number;
}

const MENU_SIZE = 17;

const TOOLBAR_SIZE = 22;

const TOOLBAR_STROKE = 2;

const MENU_STROKE = (TOOLBAR_STROKE * MENU_SIZE) / TOOLBAR_SIZE;

// A selected tab draws the same glyph a touch heavier, the way a filled SF Symbol would.
const TAB_STROKE = 1.8;

export const SETS: IconSet[] = [
    {
        because:
            "A tab item takes an asset-catalog symbol on iOS and a drawable on Android, which `react-native-nano-icons` forges from these SVGs at prebuild.",
        dir: "tab-symbols",
        entries: [
            { icon: "list", slug: "log", withSelected: true },
            { icon: "chart-line", slug: "insights", withSelected: true },
            { icon: "chart-pie", slug: "budgets", withSelected: true },
            { icon: "settings", slug: "settings", withSelected: true },
        ],
        stroke: TAB_STROKE,
    },
    {
        because: "A native toolbar item takes an SF Symbol name or an image source, never a React element.",
        dir: "toolbar-symbols",
        entries: [
            { icon: "plus", slug: "add" },
            { icon: "x", slug: "close" },
            // Android's app bar draws a custom back image untinted, so a dark bar
            // needs the glyph baked light (`stack-chrome.android.ts`).
            { icon: "x", ink: "#ffffff", slug: "close-light" },
            { icon: "trash", slug: "delete" },
            { icon: "check", slug: "done" },
            { icon: "search", slug: "search" },
            { icon: "calendar", slug: "period" },
            { icon: "arrow-up-down", slug: "reorder" },
            { icon: "ellipsis-vertical", slug: "more" },
            // The eye shows what a tap does, not the current state: suggestions on shows the crossed-out eye.
            { icon: "eye-off", slug: "suggestions-on" },
            { icon: "eye", slug: "suggestions-off" },
            { icon: "list-filter", slug: "filter" },
            // Lucide has no filled weight, so the active filter reads as a heavier line.
            { icon: "list-filter", slug: "filter-active", stroke: 2.6 },

            { icon: "receipt-text", slug: "show-all", stroke: MENU_STROKE },
            { icon: "arrow-up-down", slug: "show-type", stroke: MENU_STROKE },
            { icon: "arrow-left-right", slug: "show-transfers", stroke: MENU_STROKE },
            { icon: "calendar", slug: "show-day", stroke: MENU_STROKE },
            { icon: "calendar-days", slug: "show-week", stroke: MENU_STROKE },
            { icon: "calendar-range", slug: "show-month", stroke: MENU_STROKE },
            { icon: "tags", slug: "show-category", stroke: MENU_STROKE },
            { icon: "repeat", slug: "show-recurring", stroke: MENU_STROKE },
            { icon: "clock", slug: "show-upcoming", stroke: MENU_STROKE },
        ],
        // A bare 1.5 line looks thin beside the SF Symbols the OS draws in the same bar.
        stroke: TOOLBAR_STROKE,
    },
    {
        because:
            "An Android menu row draws a leading icon only from an image source; the SF Symbol names iOS menus take are dropped.",
        dir: "menu-symbols",
        entries: [
            { icon: "chevron-left", slug: "earlier" },
            { icon: "chevron-right", slug: "later" },
            { icon: "undo-2", slug: "now" },
        ],
        stroke: 1.75,
    },
];
