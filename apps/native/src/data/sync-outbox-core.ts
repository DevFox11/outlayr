import { and, count, eq, inArray, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
    accounts,
    appMeta,
    budgets,
    categories,
    mainBudget,
    outbox,
    savingsGoals,
    tags,
    transactionPhotos,
    transactionSplits,
    transactions,
    transactionTags,
    transfers,
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
    "savingsGoals",
    "tags",
    "transactionTags",
    "transactionPhotos",
    "transactionSplits",
    "accounts",
    "transfers",
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
    "incomeTracking",
    "showUpcoming",
    "showUpcomingSoon",
    "logViewLineGraph",
    "animatedCharts",
    "categorySuggestions",
    "aiEnrichment",
    "groundedLookup",
    "swapTimeLabel",
    "confetti",
    "budgetViewStyle",
    "use24HourClock",
    "firstWeekday",
    "firstDayOfMonth",
    "haptics",
    "logInsightsTimeFrame",
    "logInsightsType",
    "insightsTimeFrame",
    "insightsMeasure",
    "accentColor",
    // Deliberately NOT here, and each for its own reason rather than by oversight:
    // `colorScheme` is what this screen should look like in this room — an OLED
    // phone at night and a tablet in daylight want different answers, and the
    // default already follows each device on its own. `accentColor` above it is
    // the opposite: which colour the app *is* belongs to the person, like their
    // currency. `numberEntryType` describes a thumb on a keypad, and it sits
    // beside `haptics` in the settings screen for that reason — a phone typed
    // one-handed and a tablet typed with both want different answers, and
    // replicating it let a second device silently reverse a choice made here.
    // `biometricLock` and the `notification*` keys describe a
    // permission this handset holds and another may have been refused; the `sync*` keys and
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
export async function setSyncEnabled(db: Database, enabled: boolean): Promise<void> {
    await withTransaction(db, async () => {
        await setMeta(db, META_KEYS.syncEnabled, enabled ? "1" : "0");
        if (!enabled) {
            await db.delete(outbox);
        }
    });
}

export async function getSyncAccountSubject(db: Database): Promise<string | null> {
    return await getMeta(db, META_KEYS.syncAccountSubject);
}

export async function enableSyncForAccount(db: Database, accountId: string): Promise<void> {
    await withTransaction(db, async () => {
        await setMeta(db, META_KEYS.syncAccountSubject, accountId);
        await setMeta(db, META_KEYS.syncEnabled, "1");
    });
}

export async function hasResidualSyncState(db: Database): Promise<boolean> {
    if (await isSyncEnabled(db)) {
        return true;
    }
    if ((await outboxPendingCount(db)) > 0) {
        return true;
    }
    return (await getMeta(db, META_KEYS.syncCursor)) !== null || (await getMeta(db, META_KEYS.syncedAt)) !== null;
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

export async function setSyncCursor(db: Database, cursor: number): Promise<void> {
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
            entries.push({ enqueuedAt, localId: row.localId, tableName });
        }
    };

    collect("categories", await db.select({ localId: categories.id }).from(categories));
    collect("transactions", await db.select({ localId: transactions.id }).from(transactions));
    collect("budgets", await db.select({ localId: budgets.id }).from(budgets));
    collect("mainBudget", await db.select({ localId: mainBudget.id }).from(mainBudget));
    collect("savingsGoals", await db.select({ localId: savingsGoals.id }).from(savingsGoals));
    collect("tags", await db.select({ localId: tags.id }).from(tags));
    collect("transactionTags", await db.select({ localId: transactionTags.id }).from(transactionTags));
    collect("transactionPhotos", await db.select({ localId: transactionPhotos.id }).from(transactionPhotos));
    collect("transactionSplits", await db.select({ localId: transactionSplits.id }).from(transactionSplits));
    collect("accounts", await db.select({ localId: accounts.id }).from(accounts));
    collect("transfers", await db.select({ localId: transfers.id }).from(transfers));
    collect(
        "appMeta",
        await db
            .select({ localId: appMeta.key })
            .from(appMeta)
            .where(inArray(appMeta.key, [...SYNCED_META_KEYS]))
    );

    await withTransaction(db, async () => {
        for (let from = 0; from < entries.length; from += ENQUEUE_CHUNK) {
            const chunk = entries.slice(from, from + ENQUEUE_CHUNK);
            /* oxlint-disable no-await-in-loop -- the chunks share the one SQLite connection this transaction is open on, so issuing them together interleaves statements against that transaction */
            // Delete then insert, never `DO UPDATE`: an update mutates the row in
            // place and keeps its old `seq`, and `schema.ts` states the opposite —
            // "re-queuing an already pending row issues a NEW seq: a drain that
            // pushes seqs 1-500 and then deletes them cannot delete an edit that
            // arrived while it was pushing". The triggers do it this way too.
            // Matched on the whole key, not just `localId`: the queue is unique on
            // `(tableName, localId)` and a chunk spans tables.
            await db
                .delete(outbox)
                .where(
                    or(
                        ...chunk.map((entry) =>
                            and(eq(outbox.tableName, entry.tableName), eq(outbox.localId, entry.localId))
                        )
                    )
                );
            await db.insert(outbox).values(chunk);
            /* oxlint-enable no-await-in-loop */
        }
    });
}

export async function setSyncedAt(db: Database, at: Date): Promise<void> {
    await setMeta(db, META_KEYS.syncedAt, String(at.getTime()));
}

/**
 * Drops device-local replication state before a different account can adopt this
 * ledger. The next account starts at sequence zero and never receives queued
 * writes that were prepared for the prior subject.
 */
export async function resetSyncForAccountSwitch(db: Database): Promise<void> {
    await withTransaction(db, async () => {
        await db.delete(outbox);
        await db
            .delete(appMeta)
            .where(
                inArray(appMeta.key, [
                    META_KEYS.syncAccountSubject,
                    META_KEYS.syncCursor,
                    META_KEYS.syncedAt,
                    META_KEYS.syncEnabled,
                ])
            );
    });
}
