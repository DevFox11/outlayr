import { createModifier } from "@expo/ui/swift-ui/modifiers";

/**
 * SwiftUI modifiers `@expo/ui` 57.0.9 does not export, registered natively by the
 * Glow module (`modules/glow/ios/ListGroundModifiers.swift`). A `$type` no binary
 * knows is dropped by ExpoUI's registry, so on an older dev client these are inert
 * rather than fatal.
 */

/**
 * Hides the ground a scrolling container paints for itself — for a `List`, iOS's
 * `systemGroupedBackground`. Pair it with `background(...)`, which is what then shows.
 * @see Official [SwiftUI documentation](https://developer.apple.com/documentation/swiftui/view/scrollcontentbackground(_:)).
 */
export const scrollContentBackground = (visibility: "automatic" | "hidden" | "visible") =>
    createModifier("scrollContentBackground", { visibility });

/**
 * Fills the rows of a `List`, replacing `secondarySystemGroupedBackground`. Applied to
 * a `Section` it covers every row in it; headers keep their own ground.
 * @see Official [SwiftUI documentation](https://developer.apple.com/documentation/swiftui/view/listrowbackground(_:)).
 */
export const listRowBackground = (color: string) => createModifier("listRowBackground", { color });
