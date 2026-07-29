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
	label: string;
	detail: string;
}

export const APP_ICONS: readonly AppIconChoice[] = [
	{
		name: null,
		slug: "default",
		label: "Default",
		detail: "The Outlayr mark on paper. The icon the app ships with.",
	},
	{
		name: "OutlayrInk",
		slug: "ink",
		label: "Ink",
		detail: "The mark inverted — paper on ink, for darker home screens.",
	},
	{
		name: "OutlayrHairline",
		slug: "hairline",
		label: "Hairline",
		detail: "Outline only, drawn in a single ink hairline.",
	},
	{
		name: "OutlayrMono",
		slug: "mono",
		label: "Mono",
		detail: "A flat grey field with the ink mark. Quiet and neutral.",
	},
	{
		name: "OutlayrEmboss",
		slug: "emboss",
		label: "Emboss",
		detail: "Paper on paper. The mark reads only in its shadow.",
	},
];

/** Read by `app.config.ts` to copy the bundles in and declare them to actool. */
export const ALTERNATE_ICON_NAMES: readonly string[] = APP_ICONS.map(
	(icon) => icon.name,
).filter((name): name is string => name !== null);

export function appIconChoice(active: string | null): AppIconChoice {
	return APP_ICONS.find((icon) => icon.name === active) ?? APP_ICONS[0];
}

export function appIconLabel(active: string | null): string {
	return appIconChoice(active).label;
}
