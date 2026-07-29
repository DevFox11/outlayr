/**
 * Row accent colours for the Settings tab, lifted verbatim from the Swift
 * "Settings Colors" asset catalog. They are fixed brand hues, not theme tokens —
 * identical in light and dark — which is why they are raw hex rather than CSS
 * variables like the rest of the palette.
 */
export const SETTINGS_TINT = {
	notifications: "#F4D35E",
	currency: "#6FD298",
	numberEntry: "#FE6663",
	authentication: "#8E94F2",
	income: "#86CD82",
	timeFrames: "#F39B6D",
	theme: "#279AF4",
	appIcon: "#FE724E",
	cents: "#DF928E",
	upcoming: "#158AB1",
	sign: "#FF6B6B",
	animated: "#556BF5",
	categories: "#6A7CF9",
	icloud: "#FDBC3B",
	importData: "#6A8E7F",
	exportData: "#B1638B",
	erase: "#FF78A3",
	haptics: "#279AF4",
	featureLab: "#7ED99A",
	reportBug: "#7EA172",
	featureRequest: "#77B6F1",
	rate: "#FDD011",
	share: "#F73C60",
	twitter: "#23CAFF",
	about: "#DE639A",

	// Below this line the hues are NOT from Swift — the About screen's rows are
	// new here, so they had no entry to lift.
	sourceCode: "#4A5568",
	upstreamProject: "#F76C5E",
	license: "#9B8AA6",
	// The Log's trend line had no Settings row upstream, so it had no hue either.
	trendLine: "#2FA8A0",
} as const;
