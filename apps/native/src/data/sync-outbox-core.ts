import { count, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
	appMeta,
	budgets,
	categories,
	mainBudget,
	outbox,
	templateTransactions,
	transactions,
} from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";

/** The tables the outbox triggers cover, in the order a full enqueue walks them. */
export const SYNCED_TABLES = [
	"categories",
	"transactions",
	"budgets",
	"mainBudget",
	"templateTransactions",
	"appMeta",
] as const;

/**
 * The `appMeta` keys that belong to the account rather than the handset. An
 * allow-list, not a deny-list: a key added later stays device-local until
 * someone decides otherwise, which is the safe way to be wrong. It is mirrored
 * in the `appMeta` triggers' `WHEN` clause, and `outbox-triggers.test.ts` fails
 * if the two disagree.
 */
export const SYNCED_META_KEYS = [
	META_KEYS.currency,
	META_KEYS.currencyChosen,
	// How the ledger is presented. These describe the person, not the phone, so a
	// second device should open reading the way the first one does rather than at
	// stock defaults.
	"showCents",
	"showExpenseOrIncomeSign",
	"incomeTracking",
	"showUpcoming",
	"showUpcomingSoon",
	"logViewLineGraph",
	"animatedCharts",
	"categorySuggestions",
	"swapTimeLabel",
	"confetti",
	"budgetViewStyle",
	"use24HourClock",
	"firstWeekday",
	"firstDayOfMonth",
	"numberEntryType",
	"haptics",
	"logInsightsTimeFrame",
	"logInsightsType",
	"insightsTimeFrame",
	"insightsMeasure",
	// Deliberately NOT here, and each for its own reason rather than by oversight:
	// `biometricLock` and the `notification*` keys describe a permission this
	// handset holds and another may have been refused; the `sync*` keys and
	// `ledgerAdoption` describe this device's own replication identity, so
	// replicating them would hand every device the same one; `firstLaunch`,
	// `onboardingComplete` and `recurrenceRepaired` record what has happened on
	// this install, and a new phone still has its own first run to do.
] as const;

/** 999 bound variables per statement, three columns per queue entry. */
const ENQUEUE_CHUNK = 300;

export async function isSyncEnabled(db: Database): Promise<boolean> {
	return (await getMeta(db, META_KEYS.syncEnabled)) === "1";
}

/**
 * Turning the gate off drops what is queued: those entries name rows this
 * device is no longer replicating, and keeping them would push edits made while
 * signed out the next time somebody signs in.
 */
export async function setSyncEnabled(
	db: Database,
	enabled: boolean,
): Promise<void> {
	await withTransaction(db, async () => {
		await setMeta(db, META_KEYS.syncEnabled, enabled ? "1" : "0");
		if (!enabled) {
			await db.delete(outbox);
		}
	});
}

export async function getOrCreateDeviceId(db: Database): Promise<string> {
	const existing = await getMeta(db, META_KEYS.syncDeviceId);
	if (existing) {
		return existing;
	}
	const minted = newId();
	await setMeta(db, META_KEYS.syncDeviceId, minted);
	return minted;
}

/**
 * Zero for anything unreadable, which re-reads the log from the start rather
 * than skipping whatever the corrupt value pointed past. Applying a change twice
 * is a no-op; missing one is silent data loss.
 */
export async function getSyncCursor(db: Database): Promise<number> {
	const raw = await getMeta(db, META_KEYS.syncCursor);
	if (raw === null) {
		return 0;
	}
	const parsed = Number(raw);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function setSyncCursor(
	db: Database,
	cursor: number,
): Promise<void> {
	await setMeta(db, META_KEYS.syncCursor, String(cursor));
}

export async function outboxPendingCount(db: Database): Promise<number> {
	const rows = await db.select({ pending: count() }).from(outbox);
	return rows[0]?.pending ?? 0;
}

/**
 * Queues every replicated row this device holds. The triggers only fire from the
 * moment the gate opens, so without this a ledger built up before sign-in would
 * never reach the account.
 *
 * It queues tombstones too: a deletion made offline has to travel, or the first
 * pull hands the row back.
 *
 * Order matters at the call site, not here — running it before a "replace"
 * adoption pushes the local seed categories the replace exists to discard (see
 * §5 of `docs/convex-sync-design.md`).
 */
export async function enqueueAllForSync(db: Database): Promise<void> {
	const enqueuedAt = new Date();
	const entries: {
		tableName: string;
		localId: string;
		enqueuedAt: Date;
	}[] = [];

	const collect = (tableName: string, rows: { localId: string }[]) => {
		for (const row of rows) {
			entries.push({ tableName, localId: row.localId, enqueuedAt });
		}
	};

	collect(
		"categories",
		await db.select({ localId: categories.id }).from(categories),
	);
	collect(
		"transactions",
		await db.select({ localId: transactions.id }).from(transactions),
	);
	collect("budgets", await db.select({ localId: budgets.id }).from(budgets));
	collect(
		"mainBudget",
		await db.select({ localId: mainBudget.id }).from(mainBudget),
	);
	collect(
		"templateTransactions",
		await db
			.select({ localId: templateTransactions.id })
			.from(templateTransactions),
	);
	collect(
		"appMeta",
		await db
			.select({ localId: appMeta.key })
			.from(appMeta)
			.where(inArray(appMeta.key, [...SYNCED_META_KEYS])),
	);

	await withTransaction(db, async () => {
		for (let from = 0; from < entries.length; from += ENQUEUE_CHUNK) {
			await db
				.insert(outbox)
				.values(entries.slice(from, from + ENQUEUE_CHUNK))
				.onConflictDoUpdate({
					target: [outbox.tableName, outbox.localId],
					set: { enqueuedAt },
				});
		}
	});
}

/** When a replication cycle last completed here, or null if none ever has. */
export async function getSyncedAt(db: Database): Promise<Date | null> {
	const raw = await getMeta(db, META_KEYS.syncedAt);
	const ms = raw === null ? Number.NaN : Number(raw);
	return Number.isFinite(ms) ? new Date(ms) : null;
}

export async function setSyncedAt(db: Database, at: Date): Promise<void> {
	await setMeta(db, META_KEYS.syncedAt, String(at.getTime()));
}
