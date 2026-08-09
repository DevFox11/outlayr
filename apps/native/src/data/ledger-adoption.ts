import { count, gt, isNotNull, isNull, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts, budgets, categories, mainBudget, templateTransactions, transactions } from "@/db/schema";
import type { AdoptionActions, LocalLedger, RemoteLedger } from "@/domain/ledger-adoption";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { SEEDED_CATEGORY_NAMES } from "./categories-core";
import { enqueueAllForSync, setSyncEnabled } from "./sync-outbox-core";

const SEEDED_CATEGORY_COUNT = SEEDED_CATEGORY_NAMES.expense.length + SEEDED_CATEGORY_NAMES.income.length;

/**
 * What the sync engine has to answer before an adoption can run. #164 and #165
 * own it; a build without one reports `unknown` and every plan defers, which
 * leaves both ledgers untouched.
 */
export interface AdoptionEngine {
	/** Whether the signed-in account already holds replicated rows. */
	accountLedger: () => Promise<RemoteLedger>;
	/** Tombstone the account's rows so this device's ledger is the survivor. */
	discardAccountLedger: () => Promise<void>;
	/** Discard the local replica and refill it from the account's log at seq 0. */
	replaceFromAccount: () => Promise<void>;
}

/**
 * Tombstones count as content: a row deleted offline is a decision this device
 * made, and losing it hands the row back on the first pull.
 *
 * Categories are read the way §1 states the case — "no category edits beyond the
 * seed set" — because a user who spent the afternoon renaming categories and
 * logged nothing still has something to lose. `seedCategories` stamps every row
 * it writes with one `dateCreated` equal to its `updatedAt`, so an edit, a
 * deletion, or a different row count are all it takes to read as touched.
 *
 * Every uncertainty resolves toward `populated`: being wrong that way asks a
 * question, and being wrong the other way destroys a ledger.
 */
export async function localLedgerState(db: Database): Promise<LocalLedger> {
	const moneyTables = [transactions, budgets, mainBudget, templateTransactions, accounts];
	const moneyCounts = await Promise.all(moneyTables.map((table) => db.select({ total: count() }).from(table)));
	if (moneyCounts.some((rows) => (rows[0]?.total ?? 0) > 0)) {
		return "populated";
	}

	const [all] = await db.select({ total: count() }).from(categories);
	if ((all?.total ?? 0) !== SEEDED_CATEGORY_COUNT) {
		return "populated";
	}
	const [touched] = await db
		.select({ total: count() })
		.from(categories)
		.where(
			or(
				isNotNull(categories.deletedAt),
				isNull(categories.dateCreated),
				gt(categories.updatedAt, categories.dateCreated)
			)
		);
	return (touched?.total ?? 0) > 0 ? "populated" : "empty";
}

/** The account this device's ledger has already been reconciled with, if any. */
export async function adoptedAccount(db: Database): Promise<string | null> {
	return await getMeta(db, META_KEYS.ledgerAdoption);
}

export async function markAdopted(db: Database, accountId: string): Promise<void> {
	await setMeta(db, META_KEYS.ledgerAdoption, accountId);
}

/**
 * Executes an adoption. The order is the whole point:
 *
 * 1. The account's rows go first, so a failure anywhere after it still leaves
 *    this device's ledger whole and the adoption retryable.
 * 2. The local wipe-and-refill runs while the sync gate is still shut, so the
 *    outbox triggers do not queue tombstones for rows this device is discarding
 *    on purpose.
 * 3. Only then does the gate open, and only then is the backlog queued —
 *    `enqueueAllForSync` warns about exactly this ordering.
 *
 * Refuses rather than half-applying when a destructive plan arrives with no
 * engine to run it through.
 */
export async function runAdoption(
	db: Database,
	engine: AdoptionEngine | null,
	actions: AdoptionActions
): Promise<void> {
	if (actions.wipeLocal || actions.wipeAccount) {
		if (!engine) {
			throw new Error("Destructive adoption actions need a sync engine.");
		}
		if (actions.wipeAccount) {
			await engine.discardAccountLedger();
		}
		if (actions.wipeLocal) {
			await engine.replaceFromAccount();
		}
	}
	await setSyncEnabled(db, true);
	if (actions.pushLocal) {
		await enqueueAllForSync(db);
	}
}
