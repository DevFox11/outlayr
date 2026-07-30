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

export const APP_ICONS = [
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
] as const satisfies readonly AppIconChoice[];

/**
 * The literal slugs, so the preview map in `app/settings/app-icon.tsx` cannot
 * compile while it is missing one — a slug added here without a preview would
 * otherwise ship a blank 44pt tile.
 */
export type AppIconSlug = (typeof APP_ICONS)[number]["slug"];

/**
 * The predicate below cannot narrow to plain `string`: a type predicate has to
 * be assignable to the value it tests, and under the const assertion that value
 * is the literal union rather than `string | null`.
 */
type AppIconName = NonNullable<(typeof APP_ICONS)[number]["name"]>;

/** Read by `app.config.ts` to copy the bundles in and declare them to actool. */
export const ALTERNATE_ICON_NAMES: readonly string[] = APP_ICONS.map(
	(icon) => icon.name,
).filter((name): name is AppIconName => name !== null);

export function appIconChoice(active: string | null): AppIconChoice {
	return APP_ICONS.find((icon) => icon.name === active) ?? APP_ICONS[0];
}

export function appIconLabel(active: string | null): TranslationKey {
	return appIconChoice(active).label;
}
