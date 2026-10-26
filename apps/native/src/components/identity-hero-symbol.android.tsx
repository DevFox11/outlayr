import Image01Icon from "lucide-react-native/icons/image";
import SparkleIcon from "lucide-react-native/icons/sparkle";
import { View } from "react-native";

import { Icon } from "@/components/icon";

import type { IdentityHeroSymbol as IdentityHeroSymbolBase } from "./identity-hero-symbol";

const GLYPHS = { photo: Image01Icon, sparkle: SparkleIcon } as const;

export const IdentityHeroSymbol: typeof IdentityHeroSymbolBase = ({ name, size = 24, tintColor, style }) => (
    <View style={style}>
        <Icon color={tintColor} icon={GLYPHS[name]} size={size} />
    </View>
);
