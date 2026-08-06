import type { IconSvgElement } from "@hugeicons/react-native";
import {
	ClipboardPasteIcon,
	File01Icon,
	Image01Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import type { TranslationKey } from "@/i18n/catalog";

export type ImportSourceId = "csv" | "clipboard" | "screenshot";

export interface ImportSource {
	readonly id: ImportSourceId;
	readonly titleKey: TranslationKey;
	readonly subtitleKey: TranslationKey;
	readonly icon: IconSvgElement;
	readonly available: boolean;
}

export const IMPORT_SOURCES: readonly ImportSource[] = [
	{
		id: "csv",
		titleKey: "settings.import.sourceCsvTitle",
		subtitleKey: "settings.import.sourceCsvSubtitle",
		icon: File01Icon,
		available: true,
	},
	{
		id: "clipboard",
		titleKey: "settings.import.sourceClipboardTitle",
		subtitleKey: "settings.import.sourceClipboardSubtitle",
		icon: ClipboardPasteIcon,
		available: false,
	},
	{
		id: "screenshot",
		titleKey: "settings.import.sourceScreenshotTitle",
		subtitleKey: "settings.import.sourceScreenshotSubtitle",
		icon: Image01Icon,
		available: false,
	},
];
