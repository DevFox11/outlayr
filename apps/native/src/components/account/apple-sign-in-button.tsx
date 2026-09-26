import {
    AppleAuthenticationButton,
    AppleAuthenticationButtonStyle,
    AppleAuthenticationButtonType,
} from "expo-apple-authentication";
import { useTheme } from "panelui-native";
import { View } from "react-native";

import { BusyText } from "@/components/busy-text";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

export const SIGN_IN_BUTTON_HEIGHT = 52;

/**
 * Apple's own button, not a lookalike: App Review requires the system control
 * wherever Sign in with Apple is offered, and it cannot be given a busy state,
 * so the pending frame is drawn in its place.
 */
export function AppleSignInButton({
    pending,
    disabled,
    onPress,
}: {
    pending: boolean;
    disabled: boolean;
    onPress: () => void;
}) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const colors = useColors();
    const t = useTranslation();

    if (pending) {
        return (
            <View
                className="bg-foreground w-full items-center justify-center rounded-full"
                style={{ height: SIGN_IN_BUTTON_HEIGHT }}
            >
                <BusyText className="font-sans-medium text-callout" color={colors.background}>
                    {t("auth.signIn.pending")}
                </BusyText>
            </View>
        );
    }

    return (
        // `pointerEvents` alone leaves the native button focusable and announced
        // as enabled, so VoiceOver activates something that does nothing. The
        // Google button beside it already states `disabled` on its own control.
        <View
            accessibilityElementsHidden={disabled}
            importantForAccessibility={disabled ? "no-hide-descendants" : "auto"}
            pointerEvents={disabled ? "none" : "auto"}
        >
            <AppleAuthenticationButton
                buttonStyle={isDark ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
                buttonType={AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={SIGN_IN_BUTTON_HEIGHT / 2}
                onPress={onPress}
                style={{
                    height: SIGN_IN_BUTTON_HEIGHT,
                    opacity: disabled ? 0.4 : 1,
                    width: "100%",
                }}
            />
        </View>
    );
}
