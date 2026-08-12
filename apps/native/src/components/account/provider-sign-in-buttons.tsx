import { Platform, View } from "react-native";
import { AppleSignInButton } from "@/components/account/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/account/google-sign-in-button";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n/context";
import { appleCredential } from "@/lib/apple-sign-in";
import { googleIdToken, isGoogleSignInAvailable } from "@/lib/google-sign-in";
import type { ProviderSignIn, SignInProvider } from "@/lib/use-provider-sign-in";

export function ProviderSignInButtons({
	busy,
	start,
	fallbackClassName,
}: {
	busy: SignInProvider | null;
	start: ProviderSignIn["start"];
	fallbackClassName: string;
}) {
	const t = useTranslation();
	const apple = Platform.OS === "ios";
	const google = isGoogleSignInAvailable;

	return (
		<View className="gap-3">
			{apple ? (
				<AppleSignInButton
					disabled={busy !== null}
					onPress={() => start("apple", appleCredential)}
					pending={busy === "apple"}
				/>
			) : null}
			{google ? (
				<GoogleSignInButton
					disabled={busy !== null}
					onPress={() => start("google", googleIdToken)}
					pending={busy === "google"}
				/>
			) : null}
			{apple || google ? null : <Text className={fallbackClassName}>{t("settings.account.noProvider")}</Text>}
		</View>
	);
}
