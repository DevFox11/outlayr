import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	AUTH_RESTORE_BUDGET_MS,
	type AuthGate,
	authGate,
} from "@/domain/auth-gate";
import { authClient } from "@/lib/auth-client";

type AuthClient = NonNullable<typeof authClient>;

export interface AuthSession {
	gate: AuthGate;
	/** The Better Auth subject, or null whenever the gate is not `signed-in`. */
	accountId: string | null;
}

const UNCONFIGURED: AuthSession = { gate: "unconfigured", accountId: null };

const AuthSessionContext = createContext<AuthSession>(UNCONFIGURED);

export function useAuthSession(): AuthSession {
	return use(AuthSessionContext);
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
	return <LiveSession client={authClient}>{children}</LiveSession>;
}

function LiveSession({
	client,
	children,
}: {
	client: AuthClient;
	children: ReactNode;
}) {
	const { data: session, isPending } = client.useSession();
	const [restoreExpired, setRestoreExpired] = useState(false);

	useEffect(() => {
		const timer = setTimeout(
			() => setRestoreExpired(true),
			AUTH_RESTORE_BUDGET_MS,
		);
		return () => {
			clearTimeout(timer);
		};
	}, []);

	const accountId = session?.user.id ?? null;
	const value = useMemo(
		() => ({
			gate: authGate({
				configured: true,
				hasSession: accountId != null,
				restoring: isPending,
				restoreExpired,
			}),
			accountId,
		}),
		[accountId, isPending, restoreExpired],
	);

	return (
		<AuthSessionContext.Provider value={value}>
			{children}
		</AuthSessionContext.Provider>
	);
}
