import { Platform, View } from "react-native";
import { AppleSignInButton } from "@/components/account/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/account/google-sign-in-button";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";
import { appleIdToken } from "@/lib/apple-sign-in";
import { authClient } from "@/lib/auth-client";
import { googleIdToken, isGoogleSignInAvailable } from "@/lib/google-sign-in";
import { useProviderSignIn } from "@/lib/use-provider-sign-in";

type AuthClient = NonNullable<typeof authClient>;

export default function SignInScreen() {
	return authClient ? <SignIn client={authClient} /> : <Unconfigured />;
}

function SignIn({ client }: { client: AuthClient }) {
	const t = useTranslation();
	const { busy, error, start } = useProviderSignIn(client);
	const apple = Platform.OS === "ios";
	const google = isGoogleSignInAvailable;

	return (
		<Shell
			body={t("auth.signIn.body")}
			eyebrow={t("auth.signIn.eyebrow")}
			title={t("auth.signIn.title")}
		>
			<View className="gap-3">
				{apple ? (
					<AppleSignInButton
						disabled={busy !== null}
						onPress={() => start("apple", appleIdToken)}
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
				{apple || google ? null : (
					<Text className="text-muted text-subtitle leading-snug">
						{t("settings.account.noProvider")}
					</Text>
				)}
				<Text className="pt-1 text-center text-footnote text-muted">
					{t("auth.signIn.offline")}
				</Text>
				{error ? (
					<Text className="text-center text-danger text-subtitle leading-snug">
						{error}
					</Text>
				) : null}
			</View>
		</Shell>
	);
}

function Unconfigured() {
	const t = useTranslation();
	return (
		<Shell
			body={t("auth.unconfigured.body")}
			eyebrow={t("auth.unconfigured.eyebrow")}
			title={t("auth.unconfigured.title")}
		/>
	);
}

function Shell({
	eyebrow,
	title,
	body,
	children,
}: {
	eyebrow: string;
	title: string;
	body: string;
	children?: React.ReactNode;
}) {
	return (
		<View className="flex-1 bg-background px-6 pt-safe-offset-14 pb-safe-offset-5">
			<View className="gap-2">
				<MonoLabel>{eyebrow}</MonoLabel>
				<Text className="font-sans-semibold text-foreground text-title">
					{title}
				</Text>
			</View>

			<View className="flex-1 justify-center">
				<View className="border-border border-y py-5">
					<Text className="text-muted text-subtitle leading-snug">{body}</Text>
				</View>
			</View>

			{children}
		</View>
	);
}
