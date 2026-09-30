import type { EntryRateType } from "@outlayr/money/rates";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions, transfers } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { canonicalUsd } from "@/domain/canonical-usd";
import type { CanonicalUsd } from "@/domain/canonical-usd";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { newId } from "@/domain/ids";
import { merchantKey } from "@/domain/merchant-resolver";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { normalizeLead } from "@/domain/subscription-reminder";
import { isTransactionRateNeeded } from "@/domain/transaction-entry-rate";

import { getMeta, META_KEYS } from "./app-meta-core";
import type { SpendDb } from "./budget-spent";
import { cardFeeFor, cardFeeValues } from "./card-fees-core";
import type { CardFeeInput } from "./card-fees-core";
import { getCategoryById } from "./categories-core";
import { ERASED_DATE } from "./erase-core";
import {
    forgetLogoDismissal,
    isLogoCandidate,
    LOGO_CANDIDATE_KEEP_MS,
    refreshLogoCandidate,
    rememberLogoCandidate,
    rememberLogoDismissal,
} from "./logo-backfill-state";
import { localRateLookup } from "./rates";
import { insertOccurrences, scheduleSuccessor } from "./recurrence-backfill";

export const LOG_PAGE_DAYS = 30;

/**
 * A narrow column set on purpose: `details` is unbounded free text and nothing
 * in the list paints it.
 */
export const LOG_COLUMNS = {
    amount: transactions.amount,
    // Carried so a mixed-currency day can total as one figure.
    amountUsd: transactions.amountUsd,
    categoryId: transactions.categoryId,
    currency: transactions.currency,
    customColor: transactions.customColor,
    date: transactions.date,
    day: transactions.day,
    emoji: transactions.emoji,
    exchangeRate: transactions.exchangeRate,
    exchangeRateType: transactions.exchangeRateType,
    feeForId: transactions.feeForId,
    icon: transactions.icon,
    id: transactions.id,
    imageColor: transactions.imageColor,
    imageUri: transactions.imageUri,
    income: transactions.income,
    note: transactions.note,
    // Upcoming projects each scheduled entry forward, which needs the interval as
    // well as the cadence, and the day the chain was written for — a carrier
    // clamped into February still lands on the 31st in March.
    recurringAnchorDay: transactions.recurringAnchorDay,
    recurringCoefficient: transactions.recurringCoefficient,
    // And the end, or a schedule the owner has already stopped keeps counting
    // toward what their subscriptions cost a month.
    recurringEndDate: transactions.recurringEndDate,
    recurringType: transactions.recurringType,
    transferId: transactions.transferId,
} as const;

function visibleAt(nowMs: number) {
    return and(isNull(transactions.deletedAt), lte(transactions.date, new Date(nowMs)));
}

/**
 * The window is measured in **days, not rows**, because the Log prints a signed
 * subtotal per day: a plain row LIMIT would cut some day in half and print a
 * total for it that is simply wrong.
 *
 * Returned as a query builder rather than run here so the hook can run it in
 * render while the tests await it directly.
 */
export function logWindowDaysQuery(db: SpendDb, nowMs: number, days: number) {
    return db
        .selectDistinct({ day: transactions.day })
        .from(transactions)
        .where(visibleAt(nowMs))
        .orderBy(desc(transactions.day))
        .limit(days);
}

/**
 * Every row the user still has, tombstones excluded — the figure the erase
 * screen prints, which has to fall to zero the moment an erase lands.
 */
export function ledgerSizeQuery(db: SpendDb) {
    return db.select({ id: transactions.id }).from(transactions).where(isNull(transactions.deletedAt));
}

/**
 * What Recently Deleted paints. Narrower than {@link LOG_COLUMNS} because the
 * list answers "what was this and when did it go", not "what did it look like":
 * nothing here draws the identity artwork.
 */
const DELETED_COLUMNS = {
    amount: transactions.amount,
    currency: transactions.currency,
    date: transactions.date,
    deletedAt: transactions.deletedAt,
    id: transactions.id,
    income: transactions.income,
    note: transactions.note,
} as const;

export type DeletedTransaction = {
    [K in keyof typeof DELETED_COLUMNS]: Transaction[K];
};

/**
 * The tombstones, most recently deleted first. Unbounded on purpose: a delete
 * is never a hard delete, so this is the only surface that can hand an entry
 * back, and cutting it at a window would put rows permanently out of reach
 * while they sit in SQLite forever.
 *
 * Erased rows are the one exception. An erase tombstones the whole ledger, and
 * offering it all back — as blank rows, since the content is already scrubbed —
 * would answer "erase my data" with a list of it and a Restore button. They are
 * excluded by their {@link ERASED_DATE} stamp, which nothing the user can author
 * carries.
 *
 * A transfer's fee is excluded for the opposite reason: it is only ever tombstoned
 * alongside its transfer — `transfersRepo.softDelete` from one side, `remove` from
 * the other — and handing it back alone would put a live charge on a transfer that
 * no longer exists, which no surface can then take off again.
 */
export function deletedTransactionsQuery(db: SpendDb) {
    return db
        .select(DELETED_COLUMNS)
        .from(transactions)
        .where(
            and(
                isNotNull(transactions.deletedAt),
                gt(transactions.date, ERASED_DATE),
                isNull(transactions.transferId),
                sql`(${transactions.feeForId} IS NULL OR NOT EXISTS (SELECT 1 FROM ${transactions} AS purchase WHERE purchase.id = ${transactions.feeForId} AND purchase.deletedAt IS NOT NULL))`
            )
        )
        .orderBy(desc(transactions.deletedAt), desc(transactions.date));
}

/**
 * A null floor means no day matched at all, so the bound is left off rather
 * than faked.
 */
export function logWindowRowsQuery(db: SpendDb, nowMs: number, floorMs: number | null) {
    return db
        .select(LOG_COLUMNS)
        .from(transactions)
        .where(floorMs == null ? visibleAt(nowMs) : and(visibleAt(nowMs), gte(transactions.day, new Date(floorMs))))
        .orderBy(desc(transactions.day), desc(transactions.date), asc(transactions.feeForId));
}

export type Transaction = typeof transactions.$inferSelect;

export interface TransactionInput {
    /** The account this entry moves money in or out of; null is unattached. */
    accountId?: string | null;
    amount: number;
    categoryId: string | null;
    /** null = adopt the ledger's currency, which the write stamps in. */
    currency: string | null;
    /** Identity color override (hex). */
    customColor?: string | null;
    date: Date;
    details: string | null;
    /** Chosen logo emoji — mutually exclusive with `icon`. */
    emoji?: string | null;
    exchangeRate?: number | null;
    exchangeRateType?: EntryRateType | null;
    fee?: CardFeeInput | null;
    /** Chosen logo icon (registry key) — mutually exclusive with `emoji`. */
    icon?: string | null;
    /** Color derived for (or chosen for) a photo identity (hex). */
    imageColor?: string | null;
    /** Chosen logo photo URI — mutually exclusive with `icon`/`emoji`. */
    imageUri?: string | null;
    income: boolean;
    note: string;
    /** Marks the transaction as recurring. */
    onceRecurring?: boolean;
    /** Interval multiplier for the cadence (e.g. "every 2 weeks"). */
    recurringCoefficient?: number;
    recurringEndDate?: Date | null;
    /** Cadence: none=0, daily=1, weekly=2, monthly=3, yearly=4. */
    recurringType?: number;
    /** Days of notice for the due-date reminder; null is off, 0 is the day itself. */
    reminderLeadDays?: number | null;
}

type FeeValues = Awaited<ReturnType<typeof cardFeeValues>>;

function keptFeeValue(existing: Transaction, values: FeeValues, moneyKept: boolean) {
    const sameFee =
        existing.feeRate === values.feeRate &&
        existing.currency === values.currency &&
        (values.feeRate !== null || existing.amount === values.amount);
    return sameFee && moneyKept ? { amount: existing.amount, amountUsd: existing.amountUsd } : {};
}

async function writeFee(
    db: Database,
    purchaseId: string,
    values: FeeValues | null,
    now: Date,
    moneyKept = false
): Promise<void> {
    const existing = cardFeeFor(db, purchaseId);
    if (values === null) {
        if (existing !== null) {
            await db
                .update(transactions)
                .set({ deletedAt: now, updatedAt: now })
                .where(eq(transactions.id, existing.id));
        }
        return;
    }
    if (existing === null) {
        await db.insert(transactions).values({ ...values, id: newId(), updatedAt: now });
        return;
    }
    await db
        .update(transactions)
        .set({ ...values, ...keptFeeValue(existing, values, moneyKept), updatedAt: now })
        .where(eq(transactions.id, existing.id));
}

/**
 * Materializing a subscription's past charges is not done here: the form calls
 * `backfillRecurring` (`data/recurrence-backfill.ts`) after the save.
 */
async function toRow(db: Database, id: string, input: TransactionInput): Promise<typeof transactions.$inferInsert> {
    const trimmedNote = input.note.trim();
    let note = trimmedNote;
    if (note === "" && input.categoryId != null) {
        const category = await getCategoryById(db, input.categoryId);
        note = category?.name ?? "";
    }
    const details = input.details?.trim() ? input.details.trim() : null;
    const recurring = input.onceRecurring ?? false;
    const now = new Date();
    // Stamped even when the user picked nothing: a null currency means "whatever
    // the ledger setting says", so changing that setting would silently restate a
    // $18.50 lunch as €18.50.
    const currency = input.currency ?? (await displayCurrency(db));
    return {
        accountId: input.accountId ?? null,
        amount: Math.abs(input.amount),
        categoryId: input.categoryId,
        currency,
        customColor: input.customColor ?? null,
        date: input.date,
        day: startOfDay(input.date),
        details,
        emoji: input.emoji ?? null,
        icon: input.icon ?? null,
        id,
        imageColor: input.imageColor ?? null,
        imageUri: input.imageUri ?? null,
        income: input.income,
        month: firstOfMonth(input.date),
        note,
        onceRecurring: recurring,
        // Derived, never chosen: the schedule is anchored to the day the first
        // payment falls on, and re-deriving it on every write is what keeps an
        // edited first payment from leaving the chain anchored to the old day.
        recurringAnchorDay: recurring ? input.date.getDate() : null,
        recurringCoefficient: recurring ? Math.max(1, input.recurringCoefficient ?? 1) : 1,
        recurringEndDate: recurring ? (input.recurringEndDate ?? null) : null,
        recurringType: recurring ? (input.recurringType ?? 0) : 0,
        reminderLeadDays: recurring ? normalizeLead(input.reminderLeadDays ?? null) : null,
        // Frozen at write with the rate of the day the money moved; converting at
        // read time would make last month's spending change every morning.
        ...(await canonicalUsd(localRateLookup(db), {
            amount: Math.abs(input.amount),
            currency,
            date: input.date,
            displayCurrency: currency,
            exchangeRate: input.exchangeRate,
            exchangeRateType: input.exchangeRateType,
        })),
        deletedAt: null,
        updatedAt: now,
    };
}

async function displayCurrency(db: Database): Promise<string> {
    return (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
}

/**
 * The value already frozen on the row, kept when an edit leaves amount, currency
 * and date alone. Re-freezing is unsafe: the local replica is replaced wholesale
 * on every pull and the feed serves 90 days, so an older entry comes back
 * unresolvable and renaming its note would erase a value that was correct. Any
 * of the three moving returns null instead, which the next backfill pass retries.
 */
function keptCanonical(
    next: typeof transactions.$inferInsert,
    previous: Transaction | null,
    input: TransactionInput
): CanonicalUsd | null {
    if (
        previous == null ||
        previous.amount !== next.amount ||
        previous.currency !== next.currency ||
        previous.date.getTime() !== next.date.getTime()
    ) {
        return null;
    }
    if (input.exchangeRate === undefined && input.exchangeRateType === undefined) {
        return {
            amountUsd: previous.amountUsd,
            exchangeRate: previous.exchangeRate,
            exchangeRateType: previous.exchangeRateType,
        };
    }
    const requestedRateType = next.currency === "USD" ? null : (input.exchangeRateType ?? "official");
    if (previous.exchangeRateType !== requestedRateType) {
        return null;
    }
    if (input.exchangeRate !== undefined && previous.exchangeRate !== input.exchangeRate) {
        return null;
    }
    if (previous.amountUsd === null && !isTransactionRateNeeded(previous)) {
        return null;
    }
    return {
        amountUsd: previous.amountUsd,
        exchangeRate: previous.exchangeRate,
        exchangeRateType: previous.exchangeRateType,
    };
}

/**
 * Whether this edit is the user taking the photo off the transaction, as
 * opposed to saving a row whose photo this device simply has not fetched yet.
 *
 * Only the first clears `imageKey`, which is what stops the photo downloader
 * from putting the picture back. The distinction matters because a synced row
 * whose bytes have not arrived also has a null path: treating a save on THAT
 * as a removal would delete a photo the user never touched, off every device.
 *
 * `imageKey` is otherwise left alone here — a photo *replaced* keeps the old
 * key until the uploader records the new one, which is how the uploader knows
 * there is a superseded object to release.
 */
function removesPhoto(previous: Transaction | null, next: typeof transactions.$inferInsert): boolean {
    return previous?.imageUri != null && next.imageUri == null;
}

/**
 * Whether this edit takes every identity off a row that had one — a glyph,
 * an emoji, a tint or a photo. The logo backfill has to hear about it, or a
 * row saved bare and later given an emoji, then cleared, would be painted
 * over the user's decision on the next launch. `removesPhoto` is narrower on
 * purpose: only a photo has a replicated key to release.
 */
function clearsIdentity(previous: Transaction | null, next: typeof transactions.$inferInsert): boolean {
    const had =
        previous != null &&
        (previous.imageUri != null || previous.icon != null || previous.emoji != null || previous.customColor != null);
    const has = next.imageUri != null || next.icon != null || next.emoji != null || next.customColor != null;
    return had && !has;
}

/**
 * The notice an edit that never mentioned it must keep. A form builds its input
 * from the fields it paints, so a screen with no lead picker sends the key absent
 * — and writing `toRow`'s null there would turn a 3-day notice off the next time
 * the user corrected an amount, silently and for the rest of the chain's life.
 *
 * An explicit `null` still means off; only the absent key is read as "leave it".
 * Ending the schedule clears it regardless, since the preference has nothing left
 * to hang on.
 */
function keptLead(
    next: typeof transactions.$inferInsert,
    previous: Transaction | null,
    input: TransactionInput
): number | null {
    if (!next.onceRecurring) {
        return null;
    }
    return input.reminderLeadDays === undefined
        ? (previous?.reminderLeadDays ?? null)
        : (next.reminderLeadDays ?? null);
}

/**
 * Same contract as {@link keptLead}: the CSV import and the App Intent queue
 * build inputs without the field, and neither save is a detach. Only an
 * explicit `null` takes the entry off its account.
 */
function keptAccount(previous: Transaction | null, input: TransactionInput): string | null {
    return input.accountId === undefined ? (previous?.accountId ?? null) : input.accountId;
}

/**
 * The account's attached rows, newest first and unbounded — a balance counts
 * everything the account ever saw, so its history shows the same set.
 */
export function accountTransactionsQuery(db: SpendDb, accountId: string) {
    return db
        .select(LOG_COLUMNS)
        .from(transactions)
        .where(and(isNull(transactions.deletedAt), eq(transactions.accountId, accountId)))
        .orderBy(desc(transactions.date), asc(transactions.feeForId));
}

export interface CreateOptions {
    /**
     * Whether a named entry saved with its category tile becomes the logo
     * backfill's to finish — see `logo-backfill-core.ts`. On by default. The
     * CSV import passes false: its rows are history the user was told stayed
     * on the device, its review already attached every logo the cache held,
     * and one candidate write per row would make a large import quadratic.
     */
    logoCandidate?: boolean;
    inSameTransaction?: (id: string) => Promise<void>;
}

export const transactionsRepo = {
    async create(db: Database, input: TransactionInput, options: CreateOptions = {}): Promise<string> {
        const id = newId();
        const row = await toRow(db, id, input);
        const fee = input.fee == null ? null : await cardFeeValues(db, id, row, input.fee);
        const { inSameTransaction } = options;
        const write = async () => {
            await db
                .insert(transactions)
                .values(fee === null ? [row] : [row, { ...fee, id: newId(), updatedAt: row.updatedAt }]);
            await inSameTransaction?.(id);
        };
        await (inSameTransaction ? withTransaction(db, write) : write());
        // Bookkeeping, so it cannot fail the save: the row is already in, and a
        // caller told otherwise would retry and write it twice. Judged on the
        // merchant the caller gave, not on `row.note`: a blank merchant is filled
        // with the category's name above, and "Rent" is not a brand to look up.
        if (options.logoCandidate !== false && isLogoCandidate({ ...row, note: input.note })) {
            try {
                await rememberLogoCandidate(db, id, row.updatedAt.getTime(), LOGO_CANDIDATE_KEEP_MS);
            } catch (error) {
                console.warn("[outlayr] logo candidate not recorded", error);
            }
        }
        return id;
    },

    /**
     * Soft-deletes (tombstone). The UI defers this call behind the undo window.
     *
     * The newest occurrence of a subscription is both a settled charge and the
     * chain's only live schedule, so the schedule is re-anchored on a successor
     * before the row goes — otherwise removing one charge ends the subscription
     * with no warning. The tombstone is retired to `none` either way, which is
     * what makes deleting the *pending* charge the way to stop one.
     */
    async remove(db: Database, id: string, now: Date = new Date()): Promise<void> {
        const row = getTransactionById(db, id);
        const successor = row == null || row.deletedAt != null ? null : await scheduleSuccessor(db, row, now);

        await withTransaction(db, async () => {
            if (successor != null) {
                // The successor's id is derived from its schedule, so a peer that
                // already anchored the same one holds the row this would duplicate.
                await insertOccurrences(db, id, [successor], now);
            }
            // The tombstone moves `updatedAt`; the candidate follows so that a
            // restore can move it again.
            await refreshLogoCandidate(db, id, now.getTime());
            await db
                .update(transactions)
                .set({
                    deletedAt: now,
                    recurringType: RECURRING_TYPE.none,
                    reminderLeadDays: null,
                    updatedAt: now,
                })
                .where(eq(transactions.id, id));
            // A fee outliving its transfer would keep charging for a movement the
            // ledger no longer holds, and nothing downstream reads `transferId` to
            // notice. The log routes a fee's id here like any other transaction.
            if (row?.transferId != null) {
                await db
                    .update(transfers)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(eq(transfers.id, row.transferId));
            }
            await db
                .update(transactions)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(transactions.feeForId, id), isNull(transactions.deletedAt)));
        });
    },

    /**
     * Lifts a tombstone, putting the entry back on every read that filters on
     * `deletedAt`. `updatedAt` moves with it so the outbox triggers queue the row
     * and the restore travels; without that the next pull hands the entry back
     * deleted, on this device and on every other one.
     *
     * `recurringType` is left where {@link remove} retired it. Deleting the
     * pending charge is how a user ends a subscription, so resurrecting the
     * cadence here would restart a chain they stopped on purpose — and a chain
     * that was meant to survive already has, on the successor `remove` anchored
     * before it wrote the tombstone.
     *
     * Scoped to rows that are actually tombstoned, which makes a repeat restore a
     * no-op rather than a write that queues a replication carrying no change.
     *
     * A transfer's fee is out of scope for the same reason
     * {@link deletedTransactionsQuery} hides it, and nothing restores a transfer
     * today, so lifting one alone would strand a charge with no owner.
     */
    async restore(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await withTransaction(db, async () => {
            const previous = getTransactionById(db, id);
            const purchaseId = previous?.feeForId ?? null;
            const purchase = purchaseId === null ? null : getTransactionById(db, purchaseId);
            if (
                previous == null ||
                previous.deletedAt == null ||
                previous.transferId != null ||
                purchase?.deletedAt != null ||
                (purchaseId !== null && cardFeeFor(db, purchaseId) !== null)
            ) {
                return;
            }
            await refreshLogoCandidate(db, id, now.getTime());
            await db.update(transactions).set({ deletedAt: null, updatedAt: now }).where(eq(transactions.id, id));
            await db
                .update(transactions)
                .set({ deletedAt: null, updatedAt: now })
                .where(and(eq(transactions.feeForId, id), eq(transactions.deletedAt, previous.deletedAt)));
        });
    },

    /**
     * Ends the schedule and keeps the charge. The counterpart to {@link remove}:
     * no successor is anchored, so nothing is generated after this row, but the
     * row itself — including a pending charge that has yet to land — stays on the
     * ledger. `onceRecurring` is left set, so the entry still reads as a member
     * of its chain under the Recurring filter.
     *
     * Tombstones are excluded because their schedule is the only record
     * `repairOrphanedRecurrence` has left to read a broken chain back from.
     */
    async stopRecurring(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await withTransaction(db, async () => {
            const previous = getTransactionById(db, id);
            if (previous == null || previous.deletedAt != null) {
                return;
            }
            await refreshLogoCandidate(db, id, now.getTime());
            await db
                .update(transactions)
                .set({
                    recurringType: RECURRING_TYPE.none,
                    reminderLeadDays: null,
                    updatedAt: now,
                })
                .where(eq(transactions.id, id));
        });
    },

    async update(
        db: Database,
        id: string,
        input: TransactionInput,
        { inSameTransaction }: Pick<CreateOptions, "inSameTransaction"> = {}
    ): Promise<void> {
        const previous = getTransactionById(db, id);
        const row = await toRow(db, id, input);
        const { id: _omit, ...rest } = row;
        const kept = keptCanonical(row, previous, input);
        const accountId = keptAccount(previous, input);
        const fee = input.fee == null ? null : await cardFeeValues(db, id, { ...row, ...kept, accountId }, input.fee);
        // One transaction for the bookkeeping and the row: a stamp moved for
        // an UPDATE that then failed would never match the row again.
        await withTransaction(db, async () => {
            // A removal is the user's call on this row, and the logo backfill has
            // to be told or it puts an image back on the next launch. Recorded
            // BEFORE the row goes bare: the painter reads the dismissal list in its
            // own UPDATE, so once this is in there is no moment it could slip
            // through.
            if (clearsIdentity(previous, row)) {
                await rememberLogoDismissal(db, id);
            }
            // An edit made here that leaves the row bare keeps it the backfill's:
            // an existing candidate follows the new `updatedAt`, which a peer's edit
            // arriving by sync would not. A row that was never a candidate becomes
            // one only when this edit gives it a merchant name it did not have — a
            // name the user typed here is exactly what the setting discloses — so
            // an imported row edited for its amount stays out, and a cleared
            // identity is a dismissal above, never a candidate. Before the write,
            // since the refresh matches the stamp against the row as it is now.
            if (previous != null && isLogoCandidate({ ...row, note: input.note }) && !clearsIdentity(previous, row)) {
                if (merchantKey(previous.note) === merchantKey(row.note ?? "")) {
                    await refreshLogoCandidate(db, id, row.updatedAt.getTime());
                } else {
                    // A refusal recorded for the old merchant does not cover the new one.
                    await forgetLogoDismissal(db, id);
                    await rememberLogoCandidate(db, id, row.updatedAt.getTime(), LOGO_CANDIDATE_KEEP_MS);
                }
            }
            // The logo backfill may have painted the row while `toRow` was awaiting.
            // An edit that neither had nor chose an identity carries the form's
            // stale nulls; writing them would orphan a file that landed in between.
            // Read synchronously, right before the write, so nothing fits between.
            const landed = landedLogo(previous, getTransactionById(db, id), row);
            await db
                .update(transactions)
                .set({
                    ...rest,
                    ...kept,
                    ...landed,
                    accountId,
                    // Deletion is `remove` and `restore`'s call, never an edit's.
                    // `toRow` builds a fresh row and every fresh row is live, so
                    // spreading it cleared the tombstone: a peer's delete arriving
                    // while this sheet was open lost to the save, and the row came
                    // back on both devices with a newer `updatedAt` than the
                    // deletion that was meant to win.
                    deletedAt: previous?.deletedAt ?? null,
                    imageKey: removesPhoto(previous, row) ? null : rest.imageKey,
                    reminderLeadDays: keptLead(row, previous, input),
                })
                .where(eq(transactions.id, id));
            if (input.fee !== undefined && previous != null && previous.deletedAt == null) {
                await writeFee(db, id, fee, row.updatedAt, kept !== null);
            }
            await inSameTransaction?.(id);
        });
    },
};

/**
 * The identity a backfill gave the row between the edit's read and its write,
 * when the edit itself carries none — see the call site. Empty otherwise.
 */
function landedLogo(
    previous: Transaction | null,
    live: Transaction | null,
    next: typeof transactions.$inferInsert
): Partial<Pick<typeof transactions.$inferInsert, "imageColor" | "imageUri" | "updatedAt">> {
    const editHasNone = next.imageUri == null && next.icon == null && next.emoji == null && next.customColor == null;
    if (!editHasNone || previous == null || previous.imageUri != null || live?.imageUri == null) {
        return {};
    }
    // The logo was resolved for the merchant and currency as they were; an
    // edit that changed either is saving a different merchant, and the
    // backfill will look that one up rather than keep the wrong brand.
    const sameMerchant =
        merchantKey(previous.note) === merchantKey(next.note ?? "") && previous.currency === next.currency;
    if (!sameMerchant) {
        return {};
    }
    // The edit's own clock was taken before the paint landed; the row's clock
    // must not run backwards or the sync's last-writer check would drop the
    // edit as older than the logo it keeps.
    const updatedAt = new Date(Math.max(next.updatedAt.getTime(), live.updatedAt.getTime() + 1));
    return { imageColor: live.imageColor, imageUri: live.imageUri, updatedAt };
}

/**
 * Synchronous on purpose: the expo-sqlite driver executes on the JS thread
 * (`getFirstSync`), so a caller can have the row in hand during its first render
 * instead of flashing a placeholder for one frame.
 */
export function getTransactionById(db: Database, id: string): Transaction | null {
    const rows = db.select().from(transactions).where(eq(transactions.id, id)).limit(1).all();
    return rows[0] ?? null;
}
