import { useState } from "react";
import { Platform, View } from "react-native";
import { AppleSignInButton } from "@/components/account/apple-sign-in-button";
import { GoogleSignInButton } from "@/components/account/google-sign-in-button";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import {
	accountLabel,
	isSignInCancellation,
	signInFailureMessage,
} from "@/domain/account";
import { useTranslation } from "@/i18n";
import { appleIdToken } from "@/lib/apple-sign-in";
import { authClient } from "@/lib/auth-client";
import { googleIdToken, isGoogleSignInAvailable } from "@/lib/google-sign-in";

type AuthClient = NonNullable<typeof authClient>;
type Provider = "apple" | "google";
type Busy = Provider | "sign-out" | null;

export default function AccountRoute() {
	return authClient ? <Account client={authClient} /> : <AccountUnavailable />;
}

function Account({ client }: { client: AuthClient }) {
	const t = useTranslation();
	const { data: session, isPending: restoring } = client.useSession();
	const [busy, setBusy] = useState<Busy>(null);
	const [error, setError] = useState<string | null>(null);

	// Every exit from a provider sheet — token, dismissal, or failure — clears
	// `busy` here, so no path can leave the button spinning.
	const signIn = (
		provider: Provider,
		getToken: () => Promise<string | null>,
	) => {
		setError(null);
		setBusy(provider);
		getToken()
			.then(async (token) => {
				if (!token) {
					return;
				}
				const { error: rejection } = await client.signIn.social({
					idToken: { token },
					provider,
				});
				if (rejection) {
					setError(signInFailureMessage(rejection, t));
				}
			})
			.catch((cause: unknown) => {
				if (!isSignInCancellation(cause)) {
					setError(signInFailureMessage(cause, t));
				}
			})
			.finally(() => setBusy(null));
	};

	const signOut = () => {
		setError(null);
		setBusy("sign-out");
		client
			.signOut()
			.catch((cause: unknown) => setError(signInFailureMessage(cause, t)))
			.finally(() => setBusy(null));
	};

	if (session) {
		const label = accountLabel(session.user, t);
		const email = session.user.email?.trim();
		return (
			<SettingsScreen>
				<Header
					detail={email && email !== label ? email : undefined}
					eyebrow={t("settings.account.signedInAs")}
					title={label}
				/>

				<SettingsSection
					footer={t("settings.account.signOutFooter")}
					title={t("settings.account.sectionTitle")}
				>
					<LinkRow
						destructive
						icon="Logout01"
						onPress={signOut}
						title={t("settings.account.signOut")}
						value={
							busy === "sign-out" ? t("settings.account.signingOut") : undefined
						}
					/>
				</SettingsSection>

				{error ? <Failure message={error} /> : null}
			</SettingsScreen>
		);
	}

	const apple = Platform.OS === "ios";
	const google = isGoogleSignInAvailable;

	return (
		<SettingsScreen>
			<Header
				detail={t("settings.account.signedOutDetail")}
				eyebrow={t("settings.account.eyebrow")}
				title={t(
					restoring
						? "settings.account.checking"
						: "settings.account.notSignedIn",
				)}
			/>

			<View className="gap-3 pt-8">
				{apple ? (
					<AppleSignInButton
						disabled={busy !== null}
						onPress={() => signIn("apple", appleIdToken)}
						pending={busy === "apple"}
					/>
				) : null}
				{google ? (
					<GoogleSignInButton
						disabled={busy !== null}
						onPress={() => signIn("google", googleIdToken)}
						pending={busy === "google"}
					/>
				) : null}
				{apple || google ? null : (
					<Text className="text-muted text-subtitle leading-snug">
						{t("settings.account.noProvider")}
					</Text>
				)}
			</View>

			{error ? <Failure message={error} /> : null}
		</SettingsScreen>
	);
}

function AccountUnavailable() {
	const t = useTranslation();
	return (
		<SettingsScreen>
			<Header
				detail={t("settings.account.unavailableDetail")}
				eyebrow={t("settings.account.eyebrow")}
				title={t("settings.account.unavailable")}
			/>
		</SettingsScreen>
	);
}

function Header({
	eyebrow,
	title,
	detail,
}: {
	eyebrow: string;
	title: string;
	detail?: string;
}) {
	return (
		<View className="gap-1.5 pt-6">
			<MonoLabel>{eyebrow}</MonoLabel>
			<Text className="font-sans-semibold text-foreground text-title">
				{title}
			</Text>
			{detail ? (
				<Text className="pt-1 text-muted text-subtitle leading-snug">
					{detail}
				</Text>
			) : null}
		</View>
	);
}

function Failure({ message }: { message: string }) {
	return (
		<Text className="pt-4 text-danger text-subtitle leading-snug">
			{message}
		</Text>
	);
}
