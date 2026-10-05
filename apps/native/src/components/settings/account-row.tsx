import { useRouter } from "expo-router";

import { LinkRow } from "@/components/list/list-row";
import { accountRowValue } from "@/domain/account";
import type { AccountState } from "@/domain/account";
import { useTranslation } from "@/i18n/context";
import { authClient, useAuthClientSession } from "@/lib/auth-client";
import { useAuthSession } from "@/lib/auth-session";

export function AccountRow() {
    if (authClient === null) {
        return <Row state={{ kind: "signed-out" }} />;
    }
    return <SessionRow />;
}

function SessionRow() {
    const { data: session, isPending } = useAuthClientSession();
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
