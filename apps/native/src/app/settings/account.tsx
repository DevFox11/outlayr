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
					setError(signInFailureMessage(rejection));
				}
			})
			.catch((cause: unknown) => {
				if (!isSignInCancellation(cause)) {
					setError(signInFailureMessage(cause));
				}
			})
			.finally(() => setBusy(null));
	};

	const signOut = () => {
		setError(null);
		setBusy("sign-out");
		client
			.signOut()
			.catch((cause: unknown) => setError(signInFailureMessage(cause)))
			.finally(() => setBusy(null));
	};

	if (session) {
		const label = accountLabel(session.user);
		const email = session.user.email?.trim();
		return (
			<SettingsScreen>
				<Header
					detail={email && email !== label ? email : undefined}
					eyebrow="Signed in as"
					title={label}
				/>

				<SettingsSection
					footer="Signing out ends the session on this iPhone. Every transaction, budget and category stays exactly where it is."
					title="Account"
				>
					<LinkRow
						destructive
						icon="Logout01"
						onPress={signOut}
						title="Sign Out"
						value={busy === "sign-out" ? "Signing out…" : undefined}
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
				detail="Outlayr keeps your ledger on this device and behaves exactly the same signed out. An account exists only so a later release can sync it to your other devices."
				eyebrow="Account"
				title={restoring ? "Checking…" : "Not signed in"}
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
						No sign-in provider is configured for this platform.
					</Text>
				)}
			</View>

			{error ? <Failure message={error} /> : null}
		</SettingsScreen>
	);
}

function AccountUnavailable() {
	return (
		<SettingsScreen>
			<Header
				detail="This build ships without a backend, so there is no account to sign in to. Nothing else is affected — your ledger lives on this device."
				eyebrow="Account"
				title="Unavailable"
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
