import { font } from "@expo/ui/swift-ui/modifiers";
import { PlatformColor } from "react-native";

/**
 * The SwiftUI type the iOS category tree, its reorder list and the accounts
 * list share for their row names. Kept apart from `category-list-chrome` so
 * that module has the same exports on both platforms: the Android rows style
 * their names with `Text` classes and never import this.
 */

/** The system's own row-title shade, so names track the list chrome. */
export const LABEL = PlatformColor("label");

export const PARENT_NAME = font({
    design: "rounded",
    textStyle: "body",
    weight: "semibold",
});
export const CHILD_NAME = font({ design: "rounded", textStyle: "subheadline" });
