import { useRouter } from "expo-router";
import { LinkRow } from "@/components/settings/settings-row";
import { type AccountState, accountRowValue } from "@/domain/account";
import { useTranslation } from "@/i18n/context";
import { authClient } from "@/lib/auth-client";

type AuthClient = typeof authClient;

export function AccountRow() {
	return <SessionRow client={authClient} />;
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
			onPress={() => router.push("/settings/account")}
			title={t("settings.account.rowTitle")}
			value={accountRowValue(state, t)}
		/>
	);
}
