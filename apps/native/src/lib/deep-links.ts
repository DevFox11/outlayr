/**
 * The `outlayr://` contract shared by the widgets, the App Intents, the home
 * screen quick actions and any link a user has saved in Shortcuts.
 *
 * Every one of those surfaces lives outside the JS bundle — a widget hard-codes
 * its `widgetURL` in Swift, a quick action bakes its href into `Info.plist` at
 * prebuild — so the destinations cannot be `Href`-checked at the call site the
 * way an in-app `<Link>` is. Widen the contract here, never at a call site.
 *
 * The `outlayr://` names are a stable public vocabulary; the expo-router hrefs
 * they map to are wherever a screen happens to live in `app/`. Moving a screen
 * must not break a widget already sitting on someone's home screen.
 */

/** Canonical link targets. Emitted by the widgets and the App Intents. */
export const DEEP_LINKS = {
	log: "outlayr://log",
	insights: "outlayr://insights",
	budgets: "outlayr://budgets",
	overallBudget: "outlayr://budgets/overall",
	search: "outlayr://search",
	newExpense: "outlayr://new",
	newIncome: "outlayr://new?income=1",
} as const;

/** One entry, as Spotlight indexes it. See `spotlight.ts`. */
export function transactionLink(id: string): string {
	return `outlayr://transaction/${id}`;
}

/** One budget, as Spotlight indexes it. */
export function budgetLink(id: string): string {
	return `${DEEP_LINKS.budgets}/${id}`;
}

/**
 * Hosts the Swift app shipped (`Outlayr/Info.plist`, `AppIdentifiers.urlScheme`
 * + suffix). Retired but not dead: a shortcut a user built against the old build
 * still fires them, and answering with `+not-found` would be a regression.
 */
const LEGACY_HOSTS: Readonly<Record<string, string>> = {
	newexpense: "/transaction/new",
	newincome: "/transaction/new?income=1",
	budget: "/budgets",
	transactions: "/",
};

const HOSTS: Readonly<Record<string, string>> = {
	log: "/",
	insights: "/insights",
	budgets: "/budgets",
	search: "/search",
	new: "/transaction/new",
	transaction: "/transaction",
};

/**
 * Hosts whose next segment is a record id that passes straight through to the
 * route's own `[id]`. Everything else ignores trailing segments, so a malformed
 * link degrades to its section rather than to `+not-found`.
 */
const ID_HOSTS = new Set(["budgets", "transaction"]);

/**
 * Both `outlayr://budgets/overall?x=1` and the bare `/budgets/overall` form have
 * to parse: expo-router hands `redirectSystemPath` the raw URL on a cold start
 * but an already-normalized path once the app is running.
 */
function parts(raw: string): { segments: string[]; query: string } {
	const withoutScheme = raw.replace(/^[a-zA-Z][\w+.-]*:\/\//, "");
	const [pathname = "", query = ""] = withoutScheme.split("?");
	return {
		segments: pathname.split("/").filter(Boolean),
		query: query ? `?${query}` : "",
	};
}

/**
 * Maps an `outlayr://` link onto an in-app route, or returns null when the link
 * is not part of the contract — the caller then leaves it alone so expo-router
 * resolves it as an ordinary path (which is what makes an in-app `<Link>` and a
 * dev-client URL keep working through this hook).
 */
export function resolveDeepLink(raw: string): string | null {
	const { segments, query } = parts(raw);
	const [host, ...rest] = segments;
	if (!host) {
		return null;
	}

	const key = host.toLowerCase();
	const legacy = LEGACY_HOSTS[key];
	if (legacy) {
		return legacy;
	}

	const base = HOSTS[key];
	if (!base) {
		return null;
	}

	if (ID_HOSTS.has(key) && rest.length > 0) {
		return `${base}/${rest.join("/")}${query}`;
	}

	return `${base}${query}`;
}

/**
 * `drainLaunchURL` empties expo-linking's launch-URL registry. expo-router never
 * does, and it rebuilds its linking config on every render
 * (`expo-router/build/global-state/useStore.js:47`), so the URL the app was
 * launched from stays readable for the life of the process. React Navigation
 * reads it only when it mounts, which is why a release build never notices and a
 * dev reload lands back on the launch destination.
 */
export function redirectLaunchPath(
	{ path, initial }: { path: string | null; initial: boolean },
	drainLaunchURL: () => void,
): string | null {
	if (!path) {
		return path;
	}
	if (initial) {
		drainLaunchURL();
	}
	return resolveDeepLink(path) ?? path;
}
