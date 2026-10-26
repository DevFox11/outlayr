import ArchiveRestoreIcon from "lucide-react-native/icons/archive-restore";
import BadgeCentIcon from "lucide-react-native/icons/badge-cent";
import MoneyAdd01Icon from "lucide-react-native/icons/banknote-arrow-up";
import Notification03Icon from "lucide-react-native/icons/bell";
import Calculator01Icon from "lucide-react-native/icons/calculator";
import Calendar01Icon from "lucide-react-native/icons/calendar";
import CalendarClockIcon from "lucide-react-native/icons/calendar-clock";
import Camera01Icon from "lucide-react-native/icons/camera";
import ChartBarLineIcon from "lucide-react-native/icons/chart-column";
import ChartLineData01Icon from "lucide-react-native/icons/chart-line";
import Analytics01Icon from "lucide-react-native/icons/chart-spline";
import CurrencyIcon from "lucide-react-native/icons/circle-dollar-sign";
import UserCircleIcon from "lucide-react-native/icons/circle-user";
import Clock04Icon from "lucide-react-native/icons/clock";
import CloudIcon from "lucide-react-native/icons/cloud";
import SourceCodeIcon from "lucide-react-native/icons/code";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
// Lucide dropped brand glyphs, so the X row borrows the generic outbound-link mark.
import NewTwitterIcon from "lucide-react-native/icons/external-link";
import LicenseIcon from "lucide-react-native/icons/file-badge";
import FileImportIcon from "lucide-react-native/icons/file-input";
import FileExportIcon from "lucide-react-native/icons/file-output";
import LegalDocument01Icon from "lucide-react-native/icons/file-text";
import BiometricAccessIcon from "lucide-react-native/icons/fingerprint-pattern";
import DashboardSpeed01Icon from "lucide-react-native/icons/gauge";
import FavouriteIcon from "lucide-react-native/icons/heart";
import InformationCircleIcon from "lucide-react-native/icons/info";
import BankIcon from "lucide-react-native/icons/landmark";
import LanguageSkillIcon from "lucide-react-native/icons/languages";
import DashboardSquare01Icon from "lucide-react-native/icons/layout-grid";
import Logout01Icon from "lucide-react-native/icons/log-out";
import Mail01Icon from "lucide-react-native/icons/mail";
import Mic01Icon from "lucide-react-native/icons/mic";
import DarkModeIcon from "lucide-react-native/icons/moon";
import Plug01Icon from "lucide-react-native/icons/plug";
import Tap01Icon from "lucide-react-native/icons/pointer";
import Share08Icon from "lucide-react-native/icons/share";
import SecurityCheckIcon from "lucide-react-native/icons/shield-check";
import SmartPhone01Icon from "lucide-react-native/icons/smartphone";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import StarIcon from "lucide-react-native/icons/star";
import SunriseIcon from "lucide-react-native/icons/sunrise";
import SwatchIcon from "lucide-react-native/icons/swatch-book";
import LayoutTable01Icon from "lucide-react-native/icons/table";
import TestTubeIcon from "lucide-react-native/icons/test-tube";
import Delete02Icon from "lucide-react-native/icons/trash";
import TextFontIcon from "lucide-react-native/icons/type";
import UserRemove01Icon from "lucide-react-native/icons/user-round-x";
import Wallet01Icon from "lucide-react-native/icons/wallet";

import type { IconComponent } from "@/components/icon";

const REGISTRY = {
    Analytics01: Analytics01Icon,
    ArchiveRestore: ArchiveRestoreIcon,
    BadgeCent: BadgeCentIcon,
    Bank: BankIcon,
    BiometricAccess: BiometricAccessIcon,
    Calculator01: Calculator01Icon,
    Calendar01: Calendar01Icon,
    CalendarClock: CalendarClockIcon,
    Camera01: Camera01Icon,
    ChartBarLine: ChartBarLineIcon,
    ChartLineData01: ChartLineData01Icon,
    Clock04: Clock04Icon,
    Cloud: CloudIcon,
    CreditCard: CreditCardIcon,
    Currency: CurrencyIcon,
    DarkMode: DarkModeIcon,
    DashboardSpeed01: DashboardSpeed01Icon,
    DashboardSquare01: DashboardSquare01Icon,
    Delete02: Delete02Icon,
    Favourite: FavouriteIcon,
    FileExport: FileExportIcon,
    FileImport: FileImportIcon,
    InformationCircle: InformationCircleIcon,
    LanguageSkill: LanguageSkillIcon,
    LayoutTable01: LayoutTable01Icon,
    LegalDocument01: LegalDocument01Icon,
    License: LicenseIcon,
    Logout01: Logout01Icon,
    Mail01: Mail01Icon,
    Mic01: Mic01Icon,
    MoneyAdd01: MoneyAdd01Icon,
    NewTwitter: NewTwitterIcon,
    Notification03: Notification03Icon,
    Plug01: Plug01Icon,
    SecurityCheck: SecurityCheckIcon,
    Share08: Share08Icon,
    SmartPhone01: SmartPhone01Icon,
    SourceCode: SourceCodeIcon,
    Sparkles: SparklesIcon,
    Star: StarIcon,
    Sunrise: SunriseIcon,
    Swatch: SwatchIcon,
    Tap01: Tap01Icon,
    TestTube: TestTubeIcon,
    TextFont: TextFontIcon,
    UserCircle: UserCircleIcon,
    UserRemove01: UserRemove01Icon,
    Wallet01: Wallet01Icon,
} satisfies Record<string, IconComponent>;

export type SettingsIconName = keyof typeof REGISTRY;

export function settingsIcon(name: SettingsIconName): IconComponent {
    return REGISTRY[name];
}
