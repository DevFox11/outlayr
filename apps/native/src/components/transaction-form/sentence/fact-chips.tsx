import { HugeiconsIcon } from "@hugeicons/react-native";
import { Chip } from "panelui-native/components/chip";
import Animated, { LinearTransition } from "react-native-reanimated";

import { useColors } from "@/theme/use-colors";

import { cn } from "../../tw";
import { FACT_GLYPHS } from "./fact-glyphs";
import type { SentenceVerb } from "./fact-glyphs";

/**
 * A set chip is filled with `--tint` in both themes, so what sits on it is
 * literal white in both — the same rule the swipe pills follow.
 */
const ON_TINT = "#ffffff";

const CHIP_ICON = 15;

/** The row of optional facts under the sentence: icon, tags, split, repeat, note, fee. */
export function FactChips({ chips }: { chips: readonly SentenceVerb[] }) {
    const colors = useColors();
    // `layout` rather than an entering animation per chip: a label that
    // becomes its own value changes width, and the row has to close the
    // gap without every chip after it jumping. `onClose` is its own hit
    // target inside the pill, so clearing a fact no longer needs the ✕
    // this bar used to hand-roll beside each verb.
    return (
        <Animated.View className="mt-7 flex-row flex-wrap gap-2" layout={LinearTransition.duration(240)}>
            {chips.map((verb) => (
                <Chip
                    accessibilityLabel={verb.accessibilityLabel}
                    className={cn(
                        "h-auto min-h-[34px] gap-[7px]",
                        verb.active ? "border-tint bg-tint" : "border-separator border-dashed",
                        verb.disabled && "opacity-40"
                    )}
                    closeLabel={verb.removeAccessibilityLabel}
                    disabled={verb.disabled}
                    haptics
                    hitSlop={4}
                    key={verb.key}
                    // Sized with an arbitrary value on purpose: `text-subtitle`
                    // is this app's token and panelui merges with stock
                    // tailwind-merge, which files an unknown `text-*` as a
                    // COLOUR — so a token size beside `text-muted` is dropped.
                    // Ink on the vermilion fill, not white: measured, literal
                    // white is 3.33:1 on the dark theme's `--tint` and fails
                    // AA. `--accent-foreground` clears it in both themes
                    // (5.48:1 dark, 4.78:1 light) and is what panelui already
                    // paints the ✕ with, so the label and the ✕ finally agree.
                    labelClassName={cn(
                        "font-sans-medium text-[15px] leading-[21px]",
                        verb.active ? "text-accent-foreground" : "text-muted"
                    )}
                    onClose={verb.active ? verb.onRemove : undefined}
                    onPress={verb.onPress}
                    selected={verb.active}
                    // `lg` for its 14pt padding; the height and gap come from
                    // the classes above, which is the whole of the difference.
                    size="lg"
                    start={
                        <HugeiconsIcon
                            color={verb.active ? ON_TINT : colors.muted}
                            icon={verb.active ? FACT_GLYPHS[verb.key].set : FACT_GLYPHS[verb.key].unset}
                            size={CHIP_ICON}
                        />
                    }
                    variant="outline"
                >
                    {verb.label}
                </Chip>
            ))}
        </Animated.View>
    );
}
