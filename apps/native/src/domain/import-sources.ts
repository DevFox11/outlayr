import type { IconSvgElement } from "@hugeicons/react-native";
import { File01Icon } from "@hugeicons-pro/core-stroke-rounded";
import type { TranslationKey } from "@/i18n/catalog";

export type ImportSourceId = "csv";

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
];
