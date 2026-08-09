import {
	AppleAuthenticationButton,
	AppleAuthenticationButtonStyle,
	AppleAuthenticationButtonType,
} from "expo-apple-authentication";
import { useTheme } from "panelui-native";
import { ActivityIndicator, View } from "react-native";
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

	if (pending) {
		return (
			<View
				className="w-full items-center justify-center rounded-full bg-foreground"
				style={{ height: SIGN_IN_BUTTON_HEIGHT }}
			>
				<ActivityIndicator color={colors.background} />
			</View>
		);
	}

	return (
		<View pointerEvents={disabled ? "none" : "auto"}>
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
