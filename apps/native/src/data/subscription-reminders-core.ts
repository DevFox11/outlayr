import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { startOfDay } from "@/domain/dates";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { anchorDayOf, nextLanding, RECURRING_TYPE } from "@/domain/recurrence";
import type { TimeOfDay } from "@/domain/reminder";
import { reminderPlan } from "@/domain/subscription-reminder";
import type { ArmedReminder, ReminderCandidate } from "@/domain/subscription-reminder";

import { getMeta, META_KEYS } from "./app-meta-core";
import { occurrenceId } from "./recurrence-backfill";

/** Carries the copy a notification body needs, which `ArmedReminder` does not. */
export interface SubscriptionReminderCandidate extends ReminderCandidate {
    account: string | null;
    amount: number;
    category: string | null;
    chargeId: string;
    /** Resolved, never null: a row that stored none adopts the ledger's. */
    currency: string;
    income: boolean;
    note: string;
}

const CANDIDATE_COLUMNS = {
    account: accounts.name,
    amount: transactions.amount,
    category: categories.name,
    currency: transactions.currency,
    date: transactions.date,
    id: transactions.id,
    income: transactions.income,
    note: transactions.note,
    recurringAnchorDay: transactions.recurringAnchorDay,
    recurringCoefficient: transactions.recurringCoefficient,
    recurringEndDate: transactions.recurringEndDate,
    recurringType: transactions.recurringType,
    reminderLeadDays: transactions.reminderLeadDays,
} as const;

/**
 * Every live subscription that asked for a notice, resolved to the charge the
 * notice is about.
 *
 * `recurringType > 0` and a null `deletedAt` are load-bearing rather than
 * belt-and-braces: `reminderLeadDays` rides whichever row currently carries the
 * chain's schedule, so the column alone cannot tell a live carrier apart from a
 * tombstone or a retired occurrence (see its note in `db/schema.ts`).
 */
export async function reminderCandidates(db: Database, now: Date): Promise<SubscriptionReminderCandidate[]> {
    const rows = await db
        .select(CANDIDATE_COLUMNS)
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .leftJoin(accounts, and(eq(accounts.id, transactions.accountId), isNull(accounts.deletedAt)))
        .where(
            and(
                gt(transactions.recurringType, RECURRING_TYPE.none),
                isNull(transactions.deletedAt),
                isNotNull(transactions.reminderLeadDays)
            )
        );
    if (rows.length === 0) {
        return [];
    }

    // Mirrors the write path in `transactions-core`: a null `currency` means
    // "whatever the ledger setting says", so a notice has to resolve it the same
    // way rather than announce a bare number.
    const ledgerCurrency = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;

    return rows.flatMap((row) => {
        const charge = nextLanding(
            row.date,
            row.recurringType,
            row.recurringCoefficient,
            row.recurringEndDate,
            now,
            anchorDayOf(row)
        );
        // A chain that has run past its end date has no charge left to announce.
        if (charge == null) {
            return [];
        }
        return [
            {
                account: row.account,
                amount: row.amount,
                category: row.category,
                chargeId: charge.getTime() === row.date.getTime() ? row.id : occurrenceId(row.id, charge),
                currency: row.currency ?? ledgerCurrency,
                income: row.income,
                landing: startOfDay(charge),
                leadDays: row.reminderLeadDays,
                localId: row.id,
                note: row.note,
            },
        ];
    });
}

/** An armed request plus everything its notification body has to say. */
export interface PendingSubscriptionReminder extends ArmedReminder {
    account: string | null;
    amount: number;
    category: string | null;
    chargeId: string;
    currency: string;
    income: boolean;
    /** The charge itself, which `fireAt` sits `leadDays` ahead of. */
    landing: Date;
    note: string;
}

/**
 * What the scheduler *would* arm, read-only: the queue is only ever touched by
 * the caller, which has to compare this against what iOS already holds.
 */
export async function pendingReminderPlan(
    db: Database,
    now: Date,
    time: TimeOfDay,
    cap?: number
): Promise<PendingSubscriptionReminder[]> {
    const candidates = await reminderCandidates(db, now);
    const byLocalId = new Map(candidates.map((candidate) => [candidate.localId, candidate]));
    return reminderPlan({ candidates, cap, now, time }).arm.flatMap((armed) => {
        const candidate = byLocalId.get(armed.localId);
        // Unreachable — every armed request comes from a candidate — but modelled
        // as a drop rather than asserted, so a plan can never carry a body it
        // cannot fill.
        if (candidate === undefined) {
            return [];
        }
        return [
            {
                ...armed,
                account: candidate.account,
                amount: candidate.amount,
                category: candidate.category,
                chargeId: candidate.chargeId,
                currency: candidate.currency,
                income: candidate.income,
                landing: candidate.landing,
                note: candidate.note,
            },
        ];
    });
}
