import type { RootStackGroup } from "@/domain/auth-gate";
import type { TranslationKey } from "@/i18n";
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
	{ name: "settings/haptics", titleKey: "nav.settings.haptics" },
	{ name: "settings/import", titleKey: "nav.settings.import" },
	{ name: "settings/language", titleKey: "nav.settings.language" },
	{ name: "settings/notifications", titleKey: "nav.settings.notifications" },
	{ name: "settings/number-entry", titleKey: "nav.settings.numberEntry" },
	{ name: "settings/sync", titleKey: "settings.sync.navTitle" },
	{ name: "settings/theme", titleKey: "nav.settings.theme" },
	{ name: "settings/time", titleKey: "nav.settings.time" },
	{ name: "settings/upcoming", titleKey: "nav.settings.upcoming" },
];

export const CATEGORY_SHEETS: readonly {
	name: string;
	titleKey: TranslationKey;
	detent: number;
}[] = [
	{
		name: "settings/categories/create",
		titleKey: "nav.newCategory",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/index",
		titleKey: "nav.editCategory",
		detent: CATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/create",
		titleKey: "nav.newSubcategory",
		detent: SUBCATEGORY_DETENT,
	},
	{
		name: "settings/categories/[categoryId]/subcategories/[subcategoryId]",
		titleKey: "nav.subcategory",
		detent: SUBCATEGORY_DETENT,
	},
];

export const ROOT_STACK_SCREEN_NAMES: Readonly<
	Record<RootStackGroup, readonly string[]>
> = {
	onboarding: ["onboarding/index", "onboarding/currency", "onboarding/rhythm"],
	"sign-in": ["auth/sign-in"],
	adopt: ["auth/adopt"],
	ledger: [
		"(tabs)",
		"search",
		...SETTINGS_SCREENS.map((screen) => screen.name),
		"settings/categories/index",
		"settings/categories/reorder",
		...CATEGORY_SHEETS.map((sheet) => sheet.name),
		"settings/category-symbol",
		"transaction/new",
		"transaction/[id]",
		"transaction/identity",
		"import",
	],
};
