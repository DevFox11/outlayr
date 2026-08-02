import {
	Animation,
	contentShape,
	font,
	foregroundStyle,
	frame,
	padding,
	shapes,
} from "@expo/ui/swift-ui/modifiers";

export const ROW = [padding({ horizontal: 16 }), frame({ minHeight: 50 })];
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

export const BODY = font({ textStyle: "body", design: "rounded" });
export const BODY_MEDIUM = font({
	textStyle: "body",
	design: "rounded",
	weight: "medium",
});
export const BODY_SEMIBOLD = font({
	textStyle: "body",
	design: "rounded",
	weight: "semibold",
});
export const CAPTION = font({ textStyle: "caption", design: "rounded" });

export const rowLabel = foregroundStyle({
	type: "hierarchical",
	style: "secondary",
});
export const tertiary = foregroundStyle({
	type: "hierarchical",
	style: "tertiary",
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
	response: 0.4,
	dampingFraction: 0.85,
});
export const FLY_BACK = Animation.spring({
	response: 0.29,
	dampingFraction: 0.98,
});
