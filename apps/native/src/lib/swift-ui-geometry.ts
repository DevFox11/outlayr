/* oxlint-disable anti-slop/no-shape-in-symbol-names -- SwiftUI's own names for this API are `contentShape`, `shapes` and `buttonBorderShape`; they are an imported surface and cannot be renamed at the source, so this module is the one file in the tree that writes them */

/**
 * The SwiftUI geometry modifiers, re-exported under what they do here. Same
 * wrapper pattern as `@/data/live-query` and `@/lib/use-haptics`: the imported
 * name is written once, in one place, and every screen imports the domain name.
 *
 * - `hitArea` is the region a control hit-tests, which is not the region it
 *   draws. A `.plain` Button hit-tests only its glyphs, so a row without it has
 *   a dead `Spacer` gap mid-row that silently swallows taps.
 * - `outline` builds the edge a view is clipped, filled or hit-tested to.
 * - `buttonBorderOutline` is the edge a bordered button is drawn to.
 */
export {
    buttonBorderShape as buttonBorderOutline,
    contentShape as hitArea,
    shapes as outline,
} from "@expo/ui/swift-ui/modifiers";
