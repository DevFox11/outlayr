import type { RootStackGroup } from "@/domain/auth-gate";
import type { TranslationKey } from "@/i18n/catalog";
import { CATEGORY_DETENT, SUBCATEGORY_DETENT } from "@/lib/sheet-detents";

/**
 * Settings subscreens live outside `(tabs)` so pushing one drops the tab bar,
 * and on the root stack rather than a nested one so it keeps a back button.
 * `categories/index` is absent because it declares its own chrome.
 */
export const SETTINGS_SCREENS: readonly {
    name: string;
    titleKey: TranslationKey;
}[] = [
    { name: "settings/about", titleKey: "nav.settings.about" },
    { name: "settings/account", titleKey: "nav.settings.account" },
    { name: "settings/app-icon", titleKey: "nav.settings.appIcon" },
    { name: "settings/currency", titleKey: "nav.settings.currency" },
    { name: "settings/deleted", titleKey: "settings.deleted.navTitle" },
    { name: "settings/erase", titleKey: "nav.settings.erase" },
    { name: "settings/export", titleKey: "nav.settings.export" },
    { name: "settings/feature-lab", titleKey: "nav.settings.featureLab" },
    { name: "settings/notifications", titleKey: "nav.settings.notifications" },
    { name: "settings/restore", titleKey: "nav.settings.restore" },
    { name: "settings/sync", titleKey: "settings.sync.navTitle" },
    { name: "settings/time", titleKey: "nav.settings.time" },
    { name: "settings/upcoming", titleKey: "nav.settings.upcoming" },
];

export const CATEGORY_SHEETS: readonly {
    name: string;
    titleKey: TranslationKey;
    detent: number;
}[] = [
    {
        detent: CATEGORY_DETENT,
        name: "settings/categories/create",
        titleKey: "nav.newCategory",
    },
    {
        detent: CATEGORY_DETENT,
        name: "settings/categories/[categoryId]/index",
        titleKey: "nav.editCategory",
    },
    {
        detent: SUBCATEGORY_DETENT,
        name: "settings/categories/[categoryId]/subcategories/create",
        titleKey: "nav.newSubcategory",
    },
    {
        detent: SUBCATEGORY_DETENT,
        name: "settings/categories/[categoryId]/subcategories/[subcategoryId]",
        titleKey: "nav.subcategory",
    },
];

export const ROOT_STACK_SCREEN_NAMES = {
    adopt: ["auth/adopt"],
    ledger: [
        "(tabs)",
        "search",
        ...SETTINGS_SCREENS.map((screen) => screen.name),
        "settings/accounts/index",
        "settings/accounts/reorder",
        "settings/accounts/create",
        "settings/accounts/[accountId]/index",
        "settings/accounts/[accountId]/edit",
        "settings/categories/index",
        "settings/categories/reorder",
        ...CATEGORY_SHEETS.map((sheet) => sheet.name),
        "settings/category-symbol",
        "transactions/transfers/create",
        "transactions/transfers/[id]",
        "transactions/create",
        "transactions/[id]",
        "transactions/identity",
    ],
    onboarding: ["onboarding/index", "onboarding/currency", "onboarding/grounding", "onboarding/rhythm"],
    "sign-in": ["auth/sign-in"],
} satisfies Readonly<Record<RootStackGroup, readonly string[]>>;
