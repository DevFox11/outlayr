import { Text as SwiftText } from "@expo/ui/swift-ui";
import { font, foregroundStyle, kerning, textCase } from "@expo/ui/swift-ui/modifiers";
import { PlatformColor } from "react-native";

import type { ThemeColors } from "@/theme/use-colors";

/**
 * The treatment the category tree and its reorder list have in common: the same
 * category has to read as the same row on both.
 */

/** The system's own row-title shade, so names track the list chrome. */
export const LABEL = PlatformColor("label");

export const PARENT_NAME = font({
    design: "rounded",
    textStyle: "body",
    weight: "semibold",
});
export const CHILD_NAME = font({ design: "rounded", textStyle: "subheadline" });

export const PARENT_TILE = 34;
export const CHILD_TILE = 28;

/**
 * Grid's mono eyebrow. `family` is the font's PostScript name, which is what
 * `Font.custom` resolves through CoreText — the `GeistMono_400Regular` expo-font
 * alias only works on React Native's own lookup path. `textStyle` opts the custom
 * font into Dynamic Type so the eyebrow scales with the rows beneath it.
 */
const EYEBROW_FONT = font({
    family: "GeistMono-Regular",
    size: 11,
    textStyle: "caption2",
});

/**
 * `textCase` belongs here and not on the call sites: one of these headers is a
 * user-entered category name, which has to obey the eyebrow's grammar without the
 * call site remembering to uppercase it.
 *
 * This is the SwiftUI twin of `MonoLabel`, on the same 11pt / 1.2-tracking / muted
 * spec — a `Section` header slot renders a SwiftUI view, so the uniwind `Text` one
 * cannot be reused here. Restyle both or neither.
 */
export function Eyebrow({ colors, children }: { colors: ThemeColors; children: string }) {
    return (
        <SwiftText modifiers={[EYEBROW_FONT, kerning(1.2), textCase("uppercase"), foregroundStyle(colors.muted)]}>
            {children}
        </SwiftText>
    );
}
