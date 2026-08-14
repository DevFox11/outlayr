import { Animation, font } from "@expo/ui/swift-ui/modifiers";

export const FORM_BLUR_RADIUS = 8;
/**
 * MUST track `LAUNCH_SPRING`/`RETURN_SPRING` in the fly-up context: the hero is
 * a Reanimated view, this blur is a SwiftUI one, and only this pairing keeps
 * them on the same curve. Directional because the return is the snappier of the
 * two; a single curve leaves the form still un-blurring after the hero has
 * landed and the sheet has gone.
 */
export const FLY_UP = Animation.spring({
    dampingFraction: 0.85,
    response: 0.4,
});
export const FLY_BACK = Animation.spring({
    dampingFraction: 0.98,
    response: 0.29,
});

export const BODY_SEMIBOLD = font({
    design: "rounded",
    textStyle: "body",
    weight: "semibold",
});

/**
 * What the sheet's chrome takes off the top before this screen's own content:
 * `UINavigationBar` in this form sheet reports y=16 (react-native-screens'
 * grabber band) and a height of 54.
 */
export const HEADER_HEIGHT = 70;
/**
 * Swift `IdentityHero.topPadding` (24) less the 6pt the hero's ring adds above
 * its 90pt tile: Swift pads from the tile's edge and this pads from the ring's,
 * so the tile itself still lands 24pt under the bar.
 */
export const HERO_TOP_PADDING = 18;
/**
 * Swift `IdentityHero.bottomPadding` (28) less the 6pt the hero's ring adds under
 * its 90pt tile — Swift pads from the tile's edge, this pads from the ring's.
 */
export const HERO_BOTTOM_PADDING = 22;
export const FORM_TOP_MARGIN = 8;

/** Room for the empty hero's caption, which hangs below the tile until a symbol is picked. */
export const CAPTION_CLEARANCE = 24;
export const CTA_BOTTOM_PADDING = 8;
/** What `.controlSize(.large)` on a bordered-prominent button measures. */
export const CTA_HEIGHT = 50;
