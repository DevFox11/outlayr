import { RECURRING_TYPE } from "@outlayr/money/recurrence";

export interface TransactionRowActionContext {
    /** The row's stored date, which for a carrier is its last charge, not its next. */
    date: Date;
    /** True when the row is painted as an upcoming occurrence. */
    future: boolean;
    now: Date;
    recurringType: number;
}

export interface TransactionRowActions {
    canDelete: boolean;
    canLogAgain: boolean;
    canStopRecurring: boolean;
}

/** Mirrors the guards on `SingleTransactionView`'s `contextMenu` in Swift. */
export function transactionRowActions({
    recurringType,
    date,
    future,
    now,
}: TransactionRowActionContext): TransactionRowActions {
    const live = recurringType > RECURRING_TYPE.none;
    return {
        // A live carrier whose own date has passed is standing in Upcoming for a
        // charge that has not been written yet, so deleting it there reads as
        // "drop this row" while actually ending the subscription. Stop Recurring
        // states that intent outright, and Delete steps aside rather than compete.
        canDelete: !(future && live && date.getTime() < now.getTime()),
        // "Again" presupposes a first time. A row painted as upcoming is money that
        // has not moved, so there is nothing to repeat there yet. Every settled row
        // qualifies, a schedule's carrier included: what the copy takes is that
        // row's charge, and the schedule is precisely what it leaves behind.
        canLogAgain: !future,
        canStopRecurring: live,
    };
}

/**
 * A logged charge as `Log again` hands it to a fresh form. Narrower than the row
 * it is read off, and each omission is load-bearing:
 *
 * - No cadence and no reminder lead. Repeating one charge of a subscription must
 *   not mint a second schedule, which the next sweep would walk forward into a
 *   chain of its own — the same hazard the save path guards.
 * - No date. That the purchase is happening now is the whole point of the action.
 * - No photo. `imageUri` is a path into this device's container and `imageKey`
 *   owns the stored bytes, so two rows sharing one photo identity would let a
 *   delete on either release the other's picture.
 */
export interface LogAgainDraft {
    amount: number;
    categoryId: string | null;
    currency: string | null;
    customColor: string | null;
    details: string | null;
    emoji: string | null;
    icon: string | null;
    income: boolean;
    note: string;
}

/**
 * Projects a logged row onto {@link LogAgainDraft}. Named field by field rather
 * than spread-and-delete, so a column added to the table joins the copy only
 * when someone decides here that it should.
 */
export function logAgainDraft(source: LogAgainDraft): LogAgainDraft {
    return {
        amount: source.amount,
        categoryId: source.categoryId,
        currency: source.currency,
        customColor: source.customColor,
        details: source.details,
        emoji: source.emoji,
        icon: source.icon,
        income: source.income,
        note: source.note,
    };
}
