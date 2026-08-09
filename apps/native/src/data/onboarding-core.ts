import type { Database } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";

/**
 * Whether the first-run flow is done, from the one durable marker the
 * terminal step writes — not from the state of the ledger, since erasing
 * every transaction must not re-open the flow. `currencyChosen` no longer
 * settles this on its own: the flow now asks more than one question, so
 * stating a currency alone is only step one, not completion.
 */
export function isOnboardingSettled(completed: string | null): boolean {
	return completed === "true";
}

/**
 * The sole writer of `onboardingComplete`, called exactly once by either
 * terminal path — the rhythm step, or the currency step's "I already have an
 * account" shortcut.
 */
export async function finishOnboarding(db: Database): Promise<void> {
	await setMeta(db, META_KEYS.onboardingComplete, "true");
}

/** Whether the rhythm step's reminder offer was taken on this device. */
export function isReminderChosen(chosen: string | null): boolean {
	return chosen === "true";
}

/** Writer for the rhythm step's reminder offer. Skipping writes nothing. */
export async function markReminderChosen(db: Database): Promise<void> {
	await setMeta(db, META_KEYS.reminderChosen, "true");
}

/** Whether the gate's "Not now" has been taken on this device. */
export function isAccountDeferred(deferred: string | null): boolean {
	return deferred === "true";
}

/** Writer for the gate's "Not now" — opens the ledger without an account. */
export async function deferAccount(db: Database): Promise<void> {
	await setMeta(db, META_KEYS.accountDeferred, "true");
}

/**
 * A ledger that stated its currency before this flow existed has already
 * answered the one thing first-run exists to collect — re-running the flow on
 * it would ask again for nothing. `migrated` gates this to once per device: a
 * device killed between `setCurrency` and `finishOnboarding` writes
 * `currencyChosen` with `onboardingComplete` still unset, which is byte-identical
 * to a pre-flow ledger, so without the marker it would be wrongly backfilled
 * (and skip a flow it was already mid-way through) on every later launch.
 */
export function shouldSettleLegacyLedger(
	completed: string | null,
	currencyChosen: string | null,
	migrated: string | null
): boolean {
	return migrated !== "true" && completed !== "true" && currencyChosen === "true";
}

/**
 * `onboardingComplete` first, marker last — the harmless-direction rule
 * `setCurrency` and `bootstrapLocalData` also use: a kill between the two
 * re-runs a backfill that is idempotent, while the reverse order would leave
 * the ledger marked "migrated" with nothing ever backfilled, permanently
 * stranding it outside both the flow and the gate.
 */
export async function settleLegacyOnboarding(db: Database): Promise<void> {
	const [completed, currencyChosen, migrated] = await Promise.all([
		getMeta(db, META_KEYS.onboardingComplete),
		getMeta(db, META_KEYS.currencyChosen),
		getMeta(db, META_KEYS.onboardingGateMigrated),
	]);

	if (migrated === "true") {
		return;
	}

	await withTransaction(db, async () => {
		if (shouldSettleLegacyLedger(completed, currencyChosen, migrated)) {
			await setMeta(db, META_KEYS.onboardingComplete, "true");
		}
		await setMeta(db, META_KEYS.onboardingGateMigrated, "true");
	});
}
