import type { TranslationKey } from "@/i18n";

export type ThemePreference = "light" | "dark" | "system";

/** The three choices, in the order the picker offers them. */
export const THEME_OPTIONS: readonly {
	label: TranslationKey;
	detail: TranslationKey;
	value: ThemePreference;
}[] = [
	{
		label: "settings.theme.system",
		detail: "settings.theme.systemDetail",
		value: "system",
	},
	{
		label: "settings.theme.light",
		detail: "settings.theme.lightDetail",
		value: "light",
	},
	{
		label: "settings.theme.dark",
		detail: "settings.theme.darkDetail",
		value: "dark",
	},
];
