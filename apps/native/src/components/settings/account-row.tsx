import { useRouter } from "expo-router";

import { LinkRow } from "@/components/list/list-row";
import { accountRowValue } from "@/domain/account";
import type { AccountState } from "@/domain/account";
import { useTranslation } from "@/i18n/context";
import { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/lib/auth-session";

type AuthClient = NonNullable<typeof authClient>;

export function AccountRow() {
    if (authClient === null) {
        return <Row state={{ kind: "signed-out" }} />;
    }
    return <SessionRow client={authClient} />;
}

function SessionRow({ client }: { client: AuthClient }) {
    // oxlint-disable-next-line react/react-compiler -- `authClient` is a module singleton bound once at load; the `client` prop exists only so TypeScript narrows away the `null` its factory can return, so the hook is in fact the same function on every render.
    const { data: session, isPending } = client.useSession();
    const { accountId } = useAuthSession();

    if (session && accountId !== null) {
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
