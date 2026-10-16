import Cancel01Icon from "@hugeicons-pro/core-stroke-rounded/Cancel01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Button } from "panelui-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/theme/use-colors";

/**
 * Where the system puts a sheet's own close: 16pt in from the card's top and
 * trailing edge. The route is a `modal`, a card that already sits under the
 * status bar, so the window's top inset does not apply inside it (adding it put
 * the close a whole status bar too low); the trailing inset still does, for
 * landscape and iPad.
 */
const SHEET_CLOSE_INSET = 16;

export interface ModalCloseProps {
    accessibilityLabel: string;
    disabled?: boolean;
    onPress: () => void;
}

/**
 * The close row of a header-less modal (voice entry, receipt scan): a glass
 * button in the top-right corner, where a sheet keeps its own.
 */
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
                <HugeiconsIcon color={colors.foreground} icon={Cancel01Icon} size={18} strokeWidth={2} />
            </Button>
        </View>
    );
}
