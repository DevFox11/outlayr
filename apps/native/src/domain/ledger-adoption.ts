/** Whether this handset holds anything a sign-in would have to preserve. */
export type LocalLedger = "empty" | "populated";

/**
 * `unknown` is the state of every build that has no sync engine to ask. It is
 * not a failure — it is the absence of an answer, and it is deliberately its own
 * value so no call site can mistake it for `empty` and wipe a ledger over it.
 */
export type RemoteLedger = "empty" | "populated" | "unknown";

export type AdoptionPlan =
	| "fresh"
	| "adopt"
	| "replace"
	| "ask"
	/** Nothing is decidable yet; leave both sides exactly as they are. */
	| "defer";

/** Ordered as the screen offers them: the non-destructive one first. */
export const ADOPTION_CHOICES = [
	"merge",
	"keep-local",
	"keep-account",
] as const;

export type AdoptionChoice = (typeof ADOPTION_CHOICES)[number];

/**
 * What executing an adoption costs each side. The sync engine reads this rather
 * than the plan or the choice, so "keep the account's ledger" and "this install
 * was untouched" resolve to the same work.
 */
export interface AdoptionActions {
	/** Queue every local row so the account receives it. */
	pushLocal: boolean;
	/** Discard the local replica before reading the account's log from seq 0. */
	wipeLocal: boolean;
	/** Tombstone the account's rows so this device's ledger is the survivor. */
	wipeAccount: boolean;
}

/**
 * `docs/convex-sync-design.md` §1. Only the both-populated case is worth a
 * prompt: silently merging double-counts money and silently wiping destroys it,
 * while the other three have exactly one non-destructive answer each.
 */
export function adoptionPlan(
	local: LocalLedger,
	remote: RemoteLedger,
): AdoptionPlan {
	if (remote === "unknown") {
		return "defer";
	}
	if (local === "empty") {
		return remote === "empty" ? "fresh" : "replace";
	}
	return remote === "empty" ? "adopt" : "ask";
}

/** `null` where the plan resolves to no work of its own — see `choiceActions`. */
export function adoptionActions(plan: AdoptionPlan): AdoptionActions | null {
	switch (plan) {
		case "fresh":
			return { pushLocal: false, wipeLocal: false, wipeAccount: false };
		case "adopt":
			return { pushLocal: true, wipeLocal: false, wipeAccount: false };
		case "replace":
			return { pushLocal: false, wipeLocal: true, wipeAccount: false };
		case "ask":
		case "defer":
			return null;
	}
}

export function choiceActions(choice: AdoptionChoice): AdoptionActions {
	switch (choice) {
		case "merge":
			return { pushLocal: true, wipeLocal: false, wipeAccount: false };
		case "keep-local":
			return { pushLocal: true, wipeLocal: false, wipeAccount: true };
		case "keep-account":
			return { pushLocal: false, wipeLocal: true, wipeAccount: false };
	}
}

export function isDestructiveChoice(choice: AdoptionChoice): boolean {
	const actions = choiceActions(choice);
	return actions.wipeLocal || actions.wipeAccount;
}
