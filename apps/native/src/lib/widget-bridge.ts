import { ExtensionStorage } from "@bacons/apple-targets";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * The App Group the app and the App Intents target meet in, declared once in
 * `app.config.ts` and carried here through `extra`. Reading it back rather than
 * repeating the literal is what stops the two from drifting onto different
 * containers — a mismatch neither build complains about, and which surfaces only
 * as an intent whose work silently never arrives.
 *
 * The widgets do NOT come through here: `expo-widgets` owns its own transport
 * (`Widget.updateTimeline`). This group exists solely for the intent queue below.
 */
const APP_GROUP = Constants.expoConfig?.extra?.appGroup as string | undefined;

/** The key `targets/intents` appends to; see {@link drainPendingWrites}. */
export const PENDING_WRITES_KEY = "pendingWrites";

/** The key the read-only intents decode; see {@link publishIntentSnapshot}. */
export const INTENT_SNAPSHOT_KEY = "intentSnapshot";

let storage: ExtensionStorage | null = null;

function getStorage(): ExtensionStorage | null {
	if (Platform.OS !== "ios" || !APP_GROUP) {
		return null;
	}
	storage ??= new ExtensionStorage(APP_GROUP);
	return storage;
}

/**
 * What `BudgetLeftoverIntent` and `SpendingSummaryIntent` report. Mirrors
 * `IntentSnapshot` in `targets/intents/SharedStore.swift`; the field names are
 * the wire format and cannot be renamed on one side alone.
 *
 * A narrow projection of the widget props on purpose: widening it copies more of
 * the ledger into a second store the intents never read.
 */
export interface IntentSnapshot {
	budget: {
		present: boolean;
		name: string;
		periodLabel: string;
		remaining: string;
		remainingCaption: string;
		spent: string;
		limit: string;
		percent: string;
	};
	/**
	 * Every budget, so `BudgetQuery` can resolve a spoken name. Ordered overall
	 * first, which is what the intent falls back to when no budget is named.
	 */
	budgets: {
		id: string;
		name: string;
		remaining: string;
		remainingCaption: string;
		spent: string;
		limit: string;
		percent: string;
		periodLabel: string;
	}[];
	insights: {
		periodLabel: string;
		rangeLabel: string;
		net: string;
		netPositive: boolean;
		spent: string;
		income: string;
	};
}

export function publishIntentSnapshot(snapshot: IntentSnapshot): void {
	const store = getStorage();
	if (!store) {
		return;
	}
	try {
		store.set(INTENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
	} catch (error) {
		console.warn("[outlayr] intent snapshot failed", error);
	}
}

/**
 * A transaction an App Intent accepted while the app was not running. The intent
 * cannot reach SQLite — the store lives in the app's own container and the whole
 * write path (category resolution, note fallback, recurrence projection) is
 * TypeScript — so it parks the request here and the app commits it on next
 * launch. See `targets/intents/LogTransactionIntent.swift` for the writer.
 */
export interface PendingWrite {
	id: string;
	amount: number;
	income: boolean;
	note: string;
	/** Category name as spoken; resolved to a real category by the drain. */
	category: string | null;
	/** Epoch ms — when the intent ran, not when the app got around to it. */
	date: number;
	/**
	 * The amount exactly as it arrived, e.g. "€12,40" — the drain reads the
	 * currency back out of it. A Wallet purchase is in the card's currency, not
	 * the ledger's, and this app is multi-currency.
	 */
	amountText?: string | null;
	/** An explicit ISO code when the automation pinned one; beats `amountText`. */
	currency?: string | null;
}

/**
 * Reads and clears the intent queue, oldest first, so a burst of Siri entries
 * lands in the order it was spoken.
 *
 * Clearing before the caller has committed anything is deliberate: a job that
 * fails to apply is dropped rather than retried, because re-running a *money*
 * write that already half-succeeded would double-charge the ledger and there is
 * no idempotency key that survives a force-quit mid-commit.
 */
export function drainPendingWrites(): PendingWrite[] {
	const store = getStorage();
	if (!store) {
		return [];
	}
	try {
		const raw = store.get(PENDING_WRITES_KEY);
		if (!raw) {
			return [];
		}
		store.remove(PENDING_WRITES_KEY);
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as PendingWrite[]) : [];
	} catch (error) {
		console.warn("[outlayr] pending writes unreadable", error);
		return [];
	}
}
