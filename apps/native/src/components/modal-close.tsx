import Cancel01Icon from "lucide-react-native/icons/x";
import { Button } from "panelui-native/components/button";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { useColors } from "@/theme/use-colors";

// The route is a `modal` card that already sits under the status bar, so the window's top inset does not apply
// inside it; the trailing inset still does, for landscape and iPad.
const SHEET_CLOSE_INSET = 16;

export interface ModalCloseProps {
    accessibilityLabel: string;
    disabled?: boolean;
    onPress: () => void;
}

export function ModalClose({ accessibilityLabel, disabled = false, onPress }: ModalCloseProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    return (
        <View
            className="flex-row justify-end"
            style={{ paddingRight: SHEET_CLOSE_INSET + insets.right, paddingTop: SHEET_CLOSE_INSET }}
        >
            <Button
                accessibilityLabel={accessibilityLabel}
                disabled={disabled}
                glass
                native
                onPress={onPress}
                size="icon"
                variant="secondary"
            >
                <Icon color={colors.foreground} icon={Cancel01Icon} size={18} strokeWidth={2} />
            </Button>
        </View>
    );
}
