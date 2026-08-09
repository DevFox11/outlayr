import { Animation, contentShape, font, foregroundStyle, frame, shapes } from "@expo/ui/swift-ui/modifiers";

export const ROW = [frame({ minHeight: 54 })];
/**
 * For the rows that ARE buttons: a `.plain` Button hit-tests only its drawn
 * glyphs, so without a content shape the `Spacer` gap mid-row is dead and a tap
 * anywhere but directly on the label or value silently does nothing.
 *
 * Deliberately NOT applied to every row — a greedy rect over the Name,
 * date/time or toggle rows would swallow the taps meant for the control
 * living inside them.
 */
export const TAP_ROW = [...ROW, contentShape(shapes.rectangle())];
export const CARD_SHAPE = shapes.roundedRectangle({
	cornerRadius: 12,
	roundedCornerStyle: "continuous",
});

export const BODY = font({ design: "rounded", textStyle: "body" });
export const BODY_MEDIUM = font({
	design: "rounded",
	textStyle: "body",
	weight: "medium",
});
export const BODY_SEMIBOLD = font({
	design: "rounded",
	textStyle: "body",
	weight: "semibold",
});
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
export const tertiary = foregroundStyle({
	style: "tertiary",
	type: "hierarchical",
});

export const MORPH = Animation.easeInOut({ duration: 0.25 });
export const SHAKE = Animation.easeInOut({ duration: 0.1 }).repeat({
	repeatCount: 5,
});
export const FORM_BLUR_RADIUS = 8;
/**
 * MUST track `LAUNCH_SPRING`/`RETURN_SPRING` in the fly-up context — the hero is
 * a Reanimated view and the blur is a SwiftUI one, so nothing but this pairing
 * keeps them on the same curve. Directional because the return is the snappier
 * of the two; one shared curve leaves the blur clearing ~200ms after the hero is
 * home and the sheet has gone.
 */
export const FLY_UP = Animation.spring({
	dampingFraction: 0.85,
	response: 0.4,
});
export const FLY_BACK = Animation.spring({
	dampingFraction: 0.98,
	response: 0.29,
});
export const ENRICHING = Animation.easeInOut({ duration: 0.25 });
