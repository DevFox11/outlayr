import Calendar03SolidIcon from "lucide-react-native/icons/calendar";
import DivideSignCircleSolidIcon from "lucide-react-native/icons/circle-divide";
import PercentCircleSolidIcon from "lucide-react-native/icons/circle-percent";
import NoteEditSolidIcon from "lucide-react-native/icons/notebook-pen";
import Attachment01SolidIcon from "lucide-react-native/icons/paperclip";
import PlusSignIcon from "lucide-react-native/icons/plus";
import RepeatSolidIcon from "lucide-react-native/icons/repeat";
import SparklesSolidIcon from "lucide-react-native/icons/sparkles";
import Tag01SolidIcon from "lucide-react-native/icons/tag";

import type { ActionMenuItem } from "@/components/action-menu";
import type { IconComponent } from "@/components/icon";

// No platform twin: `fact-chips.tsx` and its Android sibling share it.
export const FACT_GLYPHS = {
    add: { set: PlusSignIcon, unset: PlusSignIcon },
    attach: { set: Attachment01SolidIcon, unset: Attachment01SolidIcon },
    fee: { set: PercentCircleSolidIcon, unset: PercentCircleSolidIcon },
    icon: { set: SparklesSolidIcon, unset: SparklesSolidIcon },
    installments: { set: Calendar03SolidIcon, unset: Calendar03SolidIcon },
    note: { set: NoteEditSolidIcon, unset: NoteEditSolidIcon },
    repeat: { set: RepeatSolidIcon, unset: RepeatSolidIcon },
    split: { set: DivideSignCircleSolidIcon, unset: DivideSignCircleSolidIcon },
    tags: { set: Tag01SolidIcon, unset: Tag01SolidIcon },
} as const satisfies Record<string, { set: IconComponent; unset: IconComponent }>;

export type SentenceFactKey = keyof typeof FACT_GLYPHS;

export interface SentenceVerb {
    accessibilityLabel?: string;
    active: boolean;
    disabled?: boolean;
    key: SentenceFactKey;
    /** Once the fact is set this is its value ("monthly", "3 ways"), not the noun that offered it. */
    label: string;
    menu?: readonly ActionMenuItem[];
    onPress: () => void;
    onRemove?: () => void;
    removeAccessibilityLabel?: string;
}
