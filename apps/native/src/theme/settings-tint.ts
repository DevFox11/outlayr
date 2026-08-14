/**
 * Row accent colours for the Settings tab, lifted verbatim from the Swift
 * "Settings Colors" asset catalog. They are fixed brand hues, not theme tokens —
 * identical in light and dark — which is why they are raw hex rather than CSS
 * variables like the rest of the palette.
 */
export const SETTINGS_TINT = {
    about: "#DE639A",
    animated: "#556BF5",
    appIcon: "#FE724E",
    authentication: "#8E94F2",
    categories: "#6A7CF9",
    cents: "#DF928E",
    currency: "#6FD298",
    erase: "#FF78A3",
    exportData: "#B1638B",
    featureLab: "#7ED99A",
    featureRequest: "#77B6F1",
    haptics: "#279AF4",
    icloud: "#FDBC3B",
    importData: "#6A8E7F",
    income: "#86CD82",
    license: "#9B8AA6",
    notifications: "#F4D35E",
    numberEntry: "#FE6663",
    rate: "#FDD011",
    reportBug: "#7EA172",
    share: "#F73C60",
    sign: "#FF6B6B",

    // Below this line the hues are NOT from Swift — the About screen's rows are
    // new here, so they had no entry to lift.
    sourceCode: "#4A5568",
    theme: "#279AF4",
    timeFrames: "#F39B6D",
    // The Log's trend line had no Settings row upstream, so it had no hue either.
    trendLine: "#2FA8A0",
    twitter: "#23CAFF",
    upcoming: "#158AB1",
    upstreamProject: "#F76C5E",
} as const;
