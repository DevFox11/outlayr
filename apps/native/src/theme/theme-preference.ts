import type { TranslationKey } from "@/i18n/catalog";

export type ThemePreference = "light" | "dark" | "system";

/** The three choices, in the order the picker offers them. */
export const THEME_OPTIONS: readonly {
	label: TranslationKey;
	detail: TranslationKey;
	value: ThemePreference;
}[] = [
	{
		detail: "settings.theme.systemDetail",
		label: "settings.theme.system",
		value: "system",
	},
	{
		detail: "settings.theme.lightDetail",
		label: "settings.theme.light",
		value: "light",
	},
	{
		detail: "settings.theme.darkDetail",
		label: "settings.theme.dark",
		value: "dark",
	},
];
