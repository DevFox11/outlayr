import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AUTH_RESTORE_BUDGET_MS, authGate } from "@/domain/auth-gate";
import type { AuthGate } from "@/domain/auth-gate";
import { authClient } from "@/lib/auth-client";

type AuthClient = NonNullable<typeof authClient>;

export interface AuthSession {
    /** The Better Auth subject, or null whenever the gate is not `signed-in`. */
    accountId: string | null;
    activate: () => void;
    begin: () => void;
    gate: AuthGate;
    reject: () => void;
}

const NOOP = () => undefined;
const UNCONFIGURED: AuthSession = { accountId: null, activate: NOOP, begin: NOOP, gate: "unconfigured", reject: NOOP };

const AuthSessionContext = createContext<AuthSession>(UNCONFIGURED);

export function useAuthSession(): AuthSession {
    return use(AuthSessionContext);
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
    if (authClient === null) {
        return <AuthSessionContext.Provider value={UNCONFIGURED}>{children}</AuthSessionContext.Provider>;
    }
    return <LiveSession client={authClient}>{children}</LiveSession>;
}

function LiveSession({ client, children }: { client: AuthClient; children: ReactNode }) {
    // oxlint-disable-next-line react/react-compiler -- `authClient` is a module singleton bound once at load; the `client` prop exists only so TypeScript narrows away the `null` its factory can return, so the hook is in fact the same function on every render.
    const { data: session, isPending } = client.useSession();
    const [provisional, setProvisional] = useState(false);
    const [restoreExpired, setRestoreExpired] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setRestoreExpired(true), AUTH_RESTORE_BUDGET_MS);
        return () => {
            clearTimeout(timer);
        };
    }, []);

    const begin = useCallback(() => setProvisional(true), []);
    const activate = useCallback(() => setProvisional(false), []);
    const reject = useCallback(() => setProvisional(false), []);
    const value = useMemo(
        () => ({ ...sessionView(session, isPending, provisional, restoreExpired), activate, begin, reject }),
        [activate, begin, isPending, provisional, reject, restoreExpired, session]
    );

    return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function sessionView(
    session: { user: { id: string } } | null | undefined,
    isPending: boolean,
    provisional: boolean,
    restoreExpired = false
): Pick<AuthSession, "accountId" | "gate"> {
    const accountId = provisional || session == null ? null : session.user.id;
    return {
        accountId,
        gate: authGate({
            configured: true,
            hasSession: accountId != null,
            restoreExpired: restoreExpired && !provisional,
            restoring: isPending || provisional,
        }),
    };
}
