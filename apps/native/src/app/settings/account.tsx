import { useState } from "react";
import { View } from "react-native";
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

type AuthClient = NonNullable<typeof authClient>;

export default function AccountRoute() {
	const db = useDatabase();
	return authClient ? (
		<Account client={authClient} db={db} />
	) : (
		<AccountUnavailable />
	);
}

function Account({ client, db }: { client: AuthClient; db: Database }) {
	const t = useTranslation();
	const { data: session, isPending: restoring } = client.useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

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

	if (!session) {
		return (
			<SettingsScreen>
				<Header
					eyebrow={t("settings.account.eyebrow")}
					title={t(
						restoring
							? "settings.account.checking"
							: "settings.account.notSignedIn",
					)}
				/>
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

			<SettingsSection
				footer={t("settings.account.signOutFooter")}
				title={t("settings.account.sectionTitle")}
			>
				<LinkRow
					destructive
					icon="Logout01"
					onPress={signOut}
					title={t("settings.account.signOut")}
					value={busy ? t("settings.account.signingOut") : undefined}
				/>
			</SettingsSection>

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
