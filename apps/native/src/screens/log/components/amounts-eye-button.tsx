import ViewIcon from "lucide-react-native/icons/eye";
import ViewOffSlashIcon from "lucide-react-native/icons/eye-off";
import { use } from "react";
import { View } from "react-native";

import { AmountsHiddenContext } from "@/components/amount-text";
import { GlassButton } from "@/components/glass-button";
import { Icon } from "@/components/icon";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting } from "@/data/settings-core";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

export const LOG_CONTROL_SIZE = "h-9.5 rounded-full";
export const LOG_CONTROL_SHADOW = { borderRadius: 19, boxShadow: "0 3px 10px rgba(23, 21, 15, 0.1)" } as const;

export function AmountsEyeButton() {
    const db = useDatabase();
    const t = useTranslation();
    const colors = useColors();
    const hidden = use(AmountsHiddenContext);
    return (
        <View style={LOG_CONTROL_SHADOW}>
            <GlassButton
                accessibilityLabel={t(hidden ? "log.amounts.show" : "log.amounts.hide")}
                className={`${LOG_CONTROL_SIZE} w-9.5`}
                onPress={() => {
                    setBoolSetting(db, "hideAmounts", !hidden);
                }}
            >
                <Icon
                    color={hidden ? colors.tint : colors.foreground}
                    icon={hidden ? ViewOffSlashIcon : ViewIcon}
                    size={19}
                    strokeWidth={1.8}
                />
            </GlassButton>
        </View>
    );
}
