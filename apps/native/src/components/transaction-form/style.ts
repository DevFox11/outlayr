import { font, foregroundStyle, frame } from "@expo/ui/swift-ui/modifiers";

import { hitArea, outline } from "@/lib/swift-ui-geometry";

export const ROW = [frame({ minHeight: 54 })];
/**
 * For the rows that ARE buttons: a `.plain` Button hit-tests only its drawn
 * glyphs, so without a `hitArea` the `Spacer` gap mid-row is dead and a tap
 * anywhere but directly on the label or value silently does nothing.
 *
 * Deliberately NOT applied to every row — a greedy rect over the Name,
 * date/time or toggle rows would swallow the taps meant for the control
 * living inside them.
 */
export const TAP_ROW = [...ROW, hitArea(outline.rectangle())];

export const BODY = font({ design: "rounded", textStyle: "body" });
export const CAPTION = font({ design: "rounded", textStyle: "caption" });

/**
 * Swift's `IdentityHero.topPadding` (24) less 6pt: expo-router's native header
 * centres its title 4pt higher than SwiftUI's, and the RN hero sits 2pt lower in
 * the scroll content, so an identical 24 leaves the icon reading 6pt low.
 */
export const HERO_TOP_PADDING = 18;
export const HERO_BOTTOM_PADDING = 6;

export const rowLabel = foregroundStyle({
    style: "secondary",
    type: "hierarchical",
});
