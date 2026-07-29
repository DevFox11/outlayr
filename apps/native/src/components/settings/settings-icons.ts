import type { IconSvgElement } from "@hugeicons/react-native";
import {
	Analytics01Icon,
	BadgeCentIcon,
	BiometricAccessIcon,
	Bug01Icon,
	Calculator01Icon,
	Calendar01Icon,
	CalendarClockIcon,
	ChartLineData01Icon,
	CloudIcon,
	CurrencyIcon,
	DarkModeIcon,
	DashboardSquare01Icon,
	Delete02Icon,
	FavouriteIcon,
	FileExportIcon,
	FileImportIcon,
	Idea01Icon,
	InformationCircleIcon,
	LicenseIcon,
	MoneyAdd01Icon,
	NewTwitterIcon,
	Notification03Icon,
	PlusMinus01Icon,
	Share08Icon,
	SmartPhone01Icon,
	SourceCodeIcon,
	StarIcon,
	SunriseIcon,
	Tap01Icon,
	TestTubeIcon,
	TextFontIcon,
} from "@hugeicons-pro/core-stroke-rounded";

/**
 * Keyed by Hugeicons name. Stroke, not solid: a filled glyph at 20pt blots next
 * to 16px text.
 */
const REGISTRY = {
	Analytics01: Analytics01Icon,
	BiometricAccess: BiometricAccessIcon,
	Bug01: Bug01Icon,
	Calendar01: Calendar01Icon,
	Cloud: CloudIcon,
	BadgeCent: BadgeCentIcon,
	DarkMode: DarkModeIcon,
	DashboardSquare01: DashboardSquare01Icon,
	Delete02: Delete02Icon,
	FileExport: FileExportIcon,
	FileImport: FileImportIcon,
	Idea01: Idea01Icon,
	InformationCircle: InformationCircleIcon,
	SmartPhone01: SmartPhone01Icon,
	MoneyAdd01: MoneyAdd01Icon,
	NewTwitter: NewTwitterIcon,
	Notification03: Notification03Icon,
	PlusMinus01: PlusMinus01Icon,
	Share08: Share08Icon,
	Star: StarIcon,
	Sunrise: SunriseIcon,
	Tap01: Tap01Icon,
	TestTube: TestTubeIcon,
	Currency: CurrencyIcon,
	Calculator01: Calculator01Icon,
	CalendarClock: CalendarClockIcon,
	ChartLineData01: ChartLineData01Icon,
	Favourite: FavouriteIcon,
	License: LicenseIcon,
	SourceCode: SourceCodeIcon,
	TextFont: TextFontIcon,
} satisfies Record<string, IconSvgElement>;

export type SettingsIconName = keyof typeof REGISTRY;

export function settingsIcon(name: SettingsIconName): IconSvgElement {
	return REGISTRY[name];
}
