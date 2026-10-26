import ClipboardPasteIcon from "lucide-react-native/icons/clipboard-paste";
import File01Icon from "lucide-react-native/icons/file";
import Image01Icon from "lucide-react-native/icons/image";

import type { IconComponent } from "@/components/icon";
import type { TranslationKey } from "@/i18n/catalog";

export type ImportSourceId = "csv" | "clipboard" | "screenshot";

export interface ImportSource {
    readonly available: boolean;
    readonly icon: IconComponent;
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
