import { background, listRowBackground, listStyle, scrollContentBackground } from "@expo/ui/swift-ui/modifiers";

import type { ThemeColors } from "@/theme/use-colors";

/**
 * Every modifier a SwiftUI `List` needs to stand on the app's ground instead of
 * iOS's. Hiding the scroll background alone leaves whatever is behind the `Host`,
 * so the ground is named here rather than inherited.
 */
export const groupedList = (colors: ThemeColors) => [
    listStyle("insetGrouped"),
    scrollContentBackground("hidden"),
    background(colors.groupedBackground),
];

/** The cells that float on {@link groupedList}. Goes on a `Section`, not a row. */
export const groupedRows = (colors: ThemeColors) => listRowBackground(colors.surface);
