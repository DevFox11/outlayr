import DivideSignCircleSolidIcon from "@hugeicons-pro/core-solid-rounded/DivideSignCircleIcon";
import NoteEditSolidIcon from "@hugeicons-pro/core-solid-rounded/NoteEditIcon";
import PercentCircleSolidIcon from "@hugeicons-pro/core-solid-rounded/PercentCircleIcon";
import RepeatSolidIcon from "@hugeicons-pro/core-solid-rounded/RepeatIcon";
import SparklesSolidIcon from "@hugeicons-pro/core-solid-rounded/SparklesIcon";
import Tag01SolidIcon from "@hugeicons-pro/core-solid-rounded/Tag01Icon";
import DivideSignCircleIcon from "@hugeicons-pro/core-stroke-rounded/DivideSignCircleIcon";
import NoteEditIcon from "@hugeicons-pro/core-stroke-rounded/NoteEditIcon";
import PercentCircleIcon from "@hugeicons-pro/core-stroke-rounded/PercentCircleIcon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import RepeatIcon from "@hugeicons-pro/core-stroke-rounded/RepeatIcon";
import SparklesIcon from "@hugeicons-pro/core-stroke-rounded/SparklesIcon";
import Tag01Icon from "@hugeicons-pro/core-stroke-rounded/Tag01Icon";
import type { IconSvgElement } from "@hugeicons/react-native";

/**
 * The optional facts, and the glyph each states. Stroke while the fact is unset
 * and Solid once it is — the icon carries the same outline-to-fill idea as the
 * chip around it, so the row's state reads before any of its words do.
 *
 * Shared by `fact-chips.tsx` and its Android sibling, which is why it lives in
 * a module with no platform twin.
 */
export const FACT_GLYPHS = {
    add: { set: PlusSignIcon, unset: PlusSignIcon },
    fee: { set: PercentCircleSolidIcon, unset: PercentCircleIcon },
    icon: { set: SparklesSolidIcon, unset: SparklesIcon },
    note: { set: NoteEditSolidIcon, unset: NoteEditIcon },
    repeat: { set: RepeatSolidIcon, unset: RepeatIcon },
    split: { set: DivideSignCircleSolidIcon, unset: DivideSignCircleIcon },
    tags: { set: Tag01SolidIcon, unset: Tag01Icon },
} as const satisfies Record<string, { set: IconSvgElement; unset: IconSvgElement }>;

/** Names a fact, and with it the chip's glyph. */
export type SentenceFactKey = keyof typeof FACT_GLYPHS;

export interface SentenceVerb {
    accessibilityLabel?: string;
    /** Already set, so the chip states the value and reads as a way back to it. */
    active: boolean;
    /** A fact that cannot be set yet — the split has nothing to divide without an amount. */
    disabled?: boolean;
    key: SentenceFactKey;
    /**
     * Resolved by the caller, and dynamic: once the fact is set this is its
     * VALUE — the tags' names, "monthly", "3 ways" — not the noun that offered it.
     */
    label: string;
    onPress: () => void;
    /** Clears an already-set fact, through the chip's own ✕. */
    onRemove?: () => void;
    removeAccessibilityLabel?: string;
}
