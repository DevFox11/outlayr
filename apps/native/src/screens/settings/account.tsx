import { useState } from "react";
import { Alert, View } from "react-native";
import { ProviderSignInButtons } from "@/components/account/provider-sign-in-buttons";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { setSyncEnabled } from "@/data/sync-outbox-core";
import type { Database } from "@/db/client";
import { accountLabel, signInFailureMessage } from "@/domain/account";
import { useTranslation } from "@/i18n";
import { authClient } from "@/lib/auth-client";
import { useProviderSignIn } from "@/lib/use-provider-sign-in";

type AuthClient = typeof authClient;

export function Account() {
	const db = useDatabase();
	return <AccountContent client={authClient} db={db} />;
}

function AccountContent({ client, db }: { client: AuthClient; db: Database }) {
	const t = useTranslation();
	const { data: session, isPending: restoring } = client.useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { busy: signingIn, error: signInError, start } = useProviderSignIn(client);

	// The outbox is dropped first: its entries name rows this device is no longer
	// replicating, and leaving them would push edits made while signed out to
	// whoever signs in next.
	const signOut = () => {
		setError(null);
		setBusy(true);
		setSyncEnabled(db, false)
			.then(() => client.signOut())
			.catch((cause: unknown) => setError(signInFailureMessage(cause, t)))
			.finally(() => setBusy(false));
	};

	// The gate closes before the account goes, not after: the server drops every
	// replicated row, and an outbox still holding entries would push them straight
	// back into whichever account signs in next.
	const deleteAccount = () => {
		setError(null);
		setBusy(true);
		setSyncEnabled(db, false)
			.then(() => client.deleteUser())
			.catch((cause: unknown) => setError(signInFailureMessage(cause, t)))
			.finally(() => setBusy(false));
	};

	const confirmDelete = () => {
		Alert.alert(t("settings.account.deleteConfirmTitle"), t("settings.account.deleteConfirmBody"), [
			{ style: "cancel", text: t("common.cancel") },
			{
				onPress: deleteAccount,
				style: "destructive",
				text: t("settings.account.deleteConfirm"),
			},
		]);
	};

	if (!session && restoring) {
		return (
			<SettingsScreen>
				<Header eyebrow={t("settings.account.eyebrow")} title={t("settings.account.checking")} />
			</SettingsScreen>
		);
	}

	if (!session) {
		return (
			<SettingsScreen>
				<Header
					detail={t("settings.account.signedOutDetail")}
					eyebrow={t("settings.account.eyebrow")}
					title={t("settings.account.notSignedIn")}
				/>

				<SettingsSection footer={t("settings.account.signInFooter")} title={t("settings.account.signInSection")}>
					<View className="py-4">
						<ProviderSignInButtons
							busy={signingIn}
							fallbackClassName="text-muted text-subtitle leading-snug"
							start={start}
						/>
					</View>
				</SettingsSection>

				{signInError ? <Failure message={signInError} /> : null}
			</SettingsScreen>
		);
	}

	const label = accountLabel(session.user, t);
	const email = session.user.email?.trim();

	return (
		<SettingsScreen>
			<Header
				detail={email && email !== label ? email : undefined}
				eyebrow={t("settings.account.signedInAs")}
				title={label}
			/>

			<SettingsSection footer={t("settings.account.signOutFooter")} title={t("settings.account.sectionTitle")}>
				<LinkRow
					destructive
					icon="Logout01"
					onPress={signOut}
					title={t("settings.account.signOut")}
					value={busy ? t("settings.account.signingOut") : undefined}
				/>
			</SettingsSection>

			<SettingsSection footer={t("settings.account.deleteFooter")} title={t("settings.account.deleteSection")}>
				<LinkRow
					destructive
					icon="UserRemove01"
					onPress={confirmDelete}
					title={t("settings.account.delete")}
					value={busy ? t("settings.account.deleting") : undefined}
				/>
			</SettingsSection>

			{error ? <Failure message={error} /> : null}
		</SettingsScreen>
	);
}

function Header({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
	return (
		<View className="gap-1.5 pt-6">
			<MonoLabel>{eyebrow}</MonoLabel>
			<Text className="font-sans-semibold text-foreground text-title">{title}</Text>
			{detail ? <Text className="pt-1 text-muted text-subtitle leading-snug">{detail}</Text> : null}
		</View>
	);
}

function Failure({ message }: { message: string }) {
	return <Text className="pt-4 text-danger text-subtitle leading-snug">{message}</Text>;
}
