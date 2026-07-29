import type { TranslationKey } from "@/i18n/catalog";
export interface AppIconChoice {
	/**
	 * The alternate's name in the asset catalogue, or `null` for the primary.
	 * iOS reports and accepts `null` for whichever icon the build ships as
	 * primary, so the Default row cannot name one — Debug and Release ship
	 * different primaries.
	 */
	name: string | null;
	/** Picks the preview PNG in `assets/images/app-icon-previews/`. */
	slug: string;
	label: TranslationKey;
	detail: TranslationKey;
}

export const APP_ICONS: readonly AppIconChoice[] = [
	{
		name: null,
		slug: "default",
		label: "appIcon.default.label",
		detail: "appIcon.default.detail",
	},
	{
		name: "OutlayrInk",
		slug: "ink",
		label: "appIcon.ink.label",
		detail: "appIcon.ink.detail",
	},
	{
		name: "OutlayrHairline",
		slug: "hairline",
		label: "appIcon.hairline.label",
		detail: "appIcon.hairline.detail",
	},
	{
		name: "OutlayrMono",
		slug: "mono",
		label: "appIcon.mono.label",
		detail: "appIcon.mono.detail",
	},
	{
		name: "OutlayrEmboss",
		slug: "emboss",
		label: "appIcon.emboss.label",
		detail: "appIcon.emboss.detail",
	},
];

/** Read by `app.config.ts` to copy the bundles in and declare them to actool. */
export const ALTERNATE_ICON_NAMES: readonly string[] = APP_ICONS.map(
	(icon) => icon.name,
).filter((name): name is string => name !== null);

export function appIconChoice(active: string | null): AppIconChoice {
	return APP_ICONS.find((icon) => icon.name === active) ?? APP_ICONS[0];
}

export function appIconLabel(active: string | null): TranslationKey {
	return appIconChoice(active).label;
}
