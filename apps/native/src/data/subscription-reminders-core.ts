import { and, gt, isNotNull, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { nextLanding, RECURRING_TYPE } from "@/domain/recurrence";
import type { TimeOfDay } from "@/domain/reminder";
import { reminderPlan } from "@/domain/subscription-reminder";
import type { ArmedReminder, ReminderCandidate } from "@/domain/subscription-reminder";

import { getMeta, META_KEYS } from "./app-meta-core";

/** Carries the copy a notification body needs, which `ArmedReminder` does not. */
export interface SubscriptionReminderCandidate extends ReminderCandidate {
    amount: number;
    /** Resolved, never null: a row that stored none adopts the ledger's. */
    currency: string;
    note: string;
}

const CANDIDATE_COLUMNS = {
    amount: transactions.amount,
    currency: transactions.currency,
    // `day` and not `date`: the schedule advances in whole days, and a carrier's
    // `date` still carries the clock time of the charge it last took.
    day: transactions.day,
    id: transactions.id,
    note: transactions.note,
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
        const landing = nextLanding(row.day, row.recurringType, row.recurringCoefficient, row.recurringEndDate, now);
        // A chain that has run past its end date has no charge left to announce.
        if (landing == null) {
            return [];
        }
        return [
            {
                amount: row.amount,
                currency: row.currency ?? ledgerCurrency,
                landing,
                leadDays: row.reminderLeadDays,
                localId: row.id,
                note: row.note,
            },
        ];
    });
}

/** An armed request plus everything its notification body has to say. */
export interface PendingSubscriptionReminder extends ArmedReminder {
    amount: number;
    currency: string;
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
                amount: candidate.amount,
                currency: candidate.currency,
                landing: candidate.landing,
                note: candidate.note,
            },
        ];
    });
}
