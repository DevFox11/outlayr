import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";

import type { SpendDb } from "./budget-spent";

/**
 * Kept separate from `app-meta.ts` so it never value-imports
 * `drizzle-orm/expo-sqlite`, whose React Native transitive import cannot load
 * under the node test runner.
 */
export const META_KEYS = {
    /**
     * Written when the gate's "Not now" is taken. The ledger is local-first, so an
     * account only ever adds sync — this records that the offer was declined so
     * the gate stops standing between the user and their own entries. Excluded
     * from `SYNCED_META_KEYS`: it is a fact about this device, not the account.
     */
    accountDeferred: "accountDeferred",
    currency: "currency",
    /**
     * Set the first time the user picks a currency themselves. `bootstrap` seeds
     * `currency` with the app default unconditionally, so without this the stored
     * code cannot be told apart from one nobody ever chose.
     */
    currencyChosen: "currencyChosen",
    enrichmentOutbox: "enrichmentOutbox",
    /**
     * The codes pinned to the top of every currency picker. Raw `appMeta` and not
     * a setting because `SETTING_DEFAULTS` admits only booleans and numbers, so
     * there is no string-setting mechanism to hang a list on — and this one is
     * deliberate user intent that has to survive a relaunch.
     */
    favouriteCurrencies: "favouriteCurrencies",
    firstLaunch: "firstLaunch",
    /**
     * The account the last saved transaction attached to; seeds the next
     * create's Account row. Device-local, like every key left out of
     * `SYNCED_META_KEYS`.
     */
    lastTransactionAccount: "lastTransactionAccount",
    /**
     * The category the last transfer fee was filed under; seeds the next fee's
     * Category row. Device-local, like every key left out of `SYNCED_META_KEYS`.
     */
    lastTransferFeeCategory: "lastTransferFeeCategory",
    /**
     * The most recent row the Wallet automation produced, as JSON
     * `{ at, txId }` — see `LastWalletEntry`. The Apple Pay settings screen
     * shows it as proof the automation works. Device-local: the automation
     * runs on this handset.
     */
    lastWalletEntry: "lastWalletEntry",
    /**
     * The account subject this device's ledger has already been reconciled with.
     * Holding the id rather than a flag is what makes signing into a *different*
     * account ask again instead of silently pairing two strangers' ledgers.
     * Device-local.
     */
    ledgerAdoption: "ledgerAdoption",
    /**
     * The logo backfill's own bookkeeping, all device-local: the rows this
     * device created without an identity (`logoCandidates`, id -> created at),
     * the ones whose logo the user removed by hand (`logoDismissals`), and when
     * each merchant may be asked again (`logoBackfillRetries`). The removal
     * itself replicates through the row; these only record intent and pacing.
     */
    logoBackfillRetries: "logoBackfillRetries",
    logoCandidates: "logoCandidates",
    logoDismissals: "logoDismissals",
    merchantBook: "merchantBook",
    /**
     * Written when the first-run flow finishes. `firstLaunch` cannot stand in for
     * it: bootstrap writes that one before any screen exists, so by the time the
     * flow could run it already reads as done.
     */
    onboardingComplete: "onboardingComplete",
    /**
     * Set once `settleLegacyOnboarding`'s one-time backfill has run on this
     * device. Without it, a device killed between `setCurrency` and
     * `finishOnboarding` would be indistinguishable from a pre-flow ledger and
     * get re-backfilled on every launch. Excluded from `SYNCED_META_KEYS`: this
     * records what THIS device has checked, not a fact about the account.
     */
    onboardingGateMigrated: "onboardingGateMigrated",
    /**
     * What the App Intent queue has already committed, so a queue file replayed
     * after an interrupted drain does not log the money twice. Written in the
     * same SQLite transaction as the row it records.
     */
    pendingWriteLedger: "pendingWriteLedger",
    /**
     * Set once the orphaned-chain repair has run. Deleting a schedule carrier now
     * retires it, so any tombstone still holding one predates that and is repaired
     * exactly once rather than on every sweep.
     */
    recurrenceRepaired: "recurrenceRepaired",
    /**
     * Written when the rhythm step's reminder offer is taken. `notificationOption`
     * cannot stand in for it — its default is a real option, so a skipped step is
     * indistinguishable from a chosen one. The gate's flyleaf and the deferred OS
     * permission prompt both read it. Device-local.
     */
    reminderChosen: "reminderChosen",
    /** The account subject that owns this device's local replication state. */
    syncAccountSubject: "syncAccountSubject",
    /** How far this device has read the account's change log. Device-local. */
    syncCursor: "syncCursor",
    /**
     * This device's replication identity, minted on first use. It breaks the tie
     * when two devices last wrote a row in the same millisecond, so it must stay
     * device-local — replicating it would hand every device the same one.
     */
    syncDeviceId: "syncDeviceId",
    /**
     * Whether this device replicates at all. The outbox triggers read it, so a
     * ledger that never syncs never queues a row. Device-local.
     */
    syncEnabled: "syncEnabled",
    /**
     * When a replication cycle last completed without throwing. Device-local: it
     * describes this handset's reach, not the account's state, and a second
     * device's success says nothing about whether this one is current.
     */
    syncedAt: "syncedAt",
    walletCards: "walletCards",
    /**
     * Epoch ms of the last Wallet automation run, mirrored from the App Group
     * on foreground. Proof the automation fires even when nothing was logged.
     * Device-local.
     */
    walletLastRunAt: "walletLastRunAt",
    walletShortcutAdded: "walletShortcutAdded",
} as const;

/**
 * Synchronous like `getTransactionById`, so a screen can seed its state during
 * its first render instead of flashing a placeholder for one frame.
 */
export function getMetaSync(db: Database, key: string): string | null {
    const rows = db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1).all();
    return rows[0]?.value ?? null;
}

export async function getMeta(db: SpendDb, key: string): Promise<string | null> {
    const rows = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1);
    return rows[0]?.value ?? null;
}

export async function setMeta(db: SpendDb, key: string, value: string): Promise<void> {
    await db.insert(appMeta).values({ key, value }).onConflictDoUpdate({ set: { value }, target: appMeta.key });
}
