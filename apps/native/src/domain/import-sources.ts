import ClipboardPasteIcon from "@hugeicons-pro/core-stroke-rounded/ClipboardPasteIcon";
import File01Icon from "@hugeicons-pro/core-stroke-rounded/File01Icon";
import Image01Icon from "@hugeicons-pro/core-stroke-rounded/Image01Icon";
import type { IconSvgElement } from "@hugeicons/react-native";

import type { TranslationKey } from "@/i18n/catalog";

export type ImportSourceId = "csv" | "clipboard" | "screenshot";

export interface ImportSource {
    readonly available: boolean;
    readonly icon: IconSvgElement;
    readonly id: ImportSourceId;
    readonly subtitleKey: TranslationKey;
    readonly titleKey: TranslationKey;
}

export const IMPORT_SOURCES: readonly ImportSource[] = [
    {
        available: true,
        icon: File01Icon,
        id: "csv",
        subtitleKey: "settings.import.sourceCsvSubtitle",
        titleKey: "settings.import.sourceCsvTitle",
    },
    {
        available: false,
        icon: ClipboardPasteIcon,
        id: "clipboard",
        subtitleKey: "settings.import.sourceClipboardSubtitle",
        titleKey: "settings.import.sourceClipboardTitle",
    },
    {
        available: false,
        icon: Image01Icon,
        id: "screenshot",
        subtitleKey: "settings.import.sourceScreenshotSubtitle",
        titleKey: "settings.import.sourceScreenshotTitle",
    },
];
