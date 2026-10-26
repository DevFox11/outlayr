import { RNHostView } from "@expo/ui/swift-ui";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import type { IconComponent } from "@/components/icon";

export const ROW_ICON_SIZE = 19;

export function TransactionFormRowIcon({ icon, color }: { icon: IconComponent; color: string }) {
    return (
        <RNHostView matchContents>
            <View style={{ height: ROW_ICON_SIZE, width: ROW_ICON_SIZE }}>
                <Icon color={color} icon={icon} size={ROW_ICON_SIZE} strokeWidth={1.8} />
            </View>
        </RNHostView>
    );
}
