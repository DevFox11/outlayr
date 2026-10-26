import CircleIcon from "lucide-react-native/icons/circle";
import AlertCircleSolidIcon from "lucide-react-native/icons/circle-alert";
import CheckmarkCircle02SolidIcon from "lucide-react-native/icons/circle-check";
import AddCircleSolidIcon from "lucide-react-native/icons/circle-plus";
import Search01Icon from "lucide-react-native/icons/search";
import StarIcon from "lucide-react-native/icons/star";
import Cancel01Icon from "lucide-react-native/icons/x";

import { Icon } from "@/components/icon";
import type { IconComponent } from "@/components/icon";

import type { AppSymbol as AppSymbolBase, AppSymbolName } from "./app-symbol";

const GLYPHS = {
    "checkmark.circle.fill": CheckmarkCircle02SolidIcon,
    circle: CircleIcon,
    "exclamationmark.circle.fill": AlertCircleSolidIcon,
    magnifyingglass: Search01Icon,
    "plus.circle.fill": AddCircleSolidIcon,
    star: StarIcon,
    xmark: Cancel01Icon,
} as const satisfies Record<AppSymbolName, IconComponent>;

export const AppSymbol: typeof AppSymbolBase = ({ name, size = 24, tintColor }) => (
    <Icon color={tintColor} icon={GLYPHS[name]} size={size} />
);
