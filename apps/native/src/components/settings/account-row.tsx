import { useRouter } from "expo-router";
import { LinkRow } from "@/components/settings/settings-row";
import { type AccountState, accountRowValue } from "@/domain/account";
import { useTranslation } from "@/i18n";
import { authClient } from "@/lib/auth-client";

type AuthClient = NonNullable<typeof authClient>;

/**
 * Two components because `useSession` cannot be called when there is no client
 * to call it on, and `authClient` is a module constant — so this branch is fixed
 * for the process and never changes a hook's call order.
 */
export function AccountRow() {
	return authClient ? (
		<SessionRow client={authClient} />
	) : (
		<Row state={{ kind: "unavailable" }} />
	);
}

function SessionRow({ client }: { client: AuthClient }) {
	const { data: session, isPending } = client.useSession();

	if (session) {
		return <Row state={{ kind: "signed-in", user: session.user }} />;
	}
	return <Row state={{ kind: isPending ? "pending" : "signed-out" }} />;
}

function Row({ state }: { state: AccountState }) {
	const router = useRouter();
	const t = useTranslation();
	return (
		<LinkRow
			icon="UserCircle"
			onPress={
				state.kind === "unavailable"
					? undefined
					: () => router.push("/settings/account")
			}
			title={t("settings.account.rowTitle")}
			value={accountRowValue(state, t)}
		/>
	);
}
