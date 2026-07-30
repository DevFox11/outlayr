import type { Database } from "@/db/client";
import { META_KEYS, setMeta } from "./app-meta-core";
import { setCurrency } from "./settings-core";

/**
 * Whether the first-run question has been answered, from the two durable
 * markers rather than from the state of the ledger — erasing every transaction
 * must not re-open the flow, and an empty ledger on a fresh install is not what
 * makes it due.
 *
 * `currencyChosen` settles it on its own. Only the picker writes it, so a ledger
 * carrying it has already stated the one thing this flow exists to collect, and
 * asking again would be noise. That is what keeps ledgers predating the flow out
 * of it.
 */
export function isOnboardingSettled(
	completed: string | null,
	currencyChosen: string | null,
): boolean {
	return completed === "true" || currencyChosen === "true";
}

/**
 * `setCurrency` first, marker last. A kill between the two re-runs a flow that
 * is idempotent; the reverse order would retire it having stated nothing, which
 * is the one outcome that cannot be recovered from — `stampLedgerCurrency` would
 * decline those rows forever.
 */
export async function completeOnboarding(
	db: Database,
	code: string,
): Promise<void> {
	await setCurrency(db, code);
	await setMeta(db, META_KEYS.onboardingComplete, "true");
}
