import { and, eq, inArray, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { installmentPlans, installments, outsidePayments, transfers } from "@/db/schema";

/** What belongs to a plan and goes and comes back with it. */
const PLAN_CHILDREN = [installments, outsidePayments] as const;

/**
 * Tombstones the orders `where` selects with their rows and outside payments. `unlink` also clears
 * their payments' link, leaving plain transfers, because the money did move;
 * a link to a tombstoned plan is inert, so a cascade that may be undone keeps it.
 *
 * Statements only, like `tombstoneTransfersTouchingAccount`, so the delete it
 * belongs to supplies the transaction. Its own module so the transaction and
 * account repos can call it without importing `installments-core`, which
 * imports them.
 */
export async function tombstonePlans(db: Database, where: SQL, now: Date, unlink: boolean): Promise<void> {
    const doomed = db
        .select({ id: installmentPlans.id })
        .from(installmentPlans)
        .where(and(isNull(installmentPlans.deletedAt), where));
    if (unlink) {
        await db
            .update(transfers)
            .set({ installmentPlanId: null, updatedAt: now })
            .where(inArray(transfers.installmentPlanId, doomed));
    }
    await Promise.all(
        PLAN_CHILDREN.map((child) =>
            db
                .update(child)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(isNull(child.deletedAt), inArray(child.planId, doomed)))
        )
    );
    await db
        .update(installmentPlans)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(isNull(installmentPlans.deletedAt), where));
}

/** The purchase entry going takes its order with it, payments still linked so a restore can bring it back. */
export async function tombstonePlansForTransaction(db: Database, transactionId: string, now: Date): Promise<void> {
    await tombstonePlans(db, eq(installmentPlans.transactionId, transactionId), now, false);
}

/**
 * The purchase entry restored brings back what its delete took: the orders,
 * rows and outside payments tombstoned at the same instant. Ones deleted on
 * their own before it stay deleted.
 */
export async function restorePlansForTransaction(
    db: Database,
    transactionId: string,
    deletedAt: Date,
    now: Date
): Promise<void> {
    const taken = and(eq(installmentPlans.transactionId, transactionId), eq(installmentPlans.deletedAt, deletedAt));
    await Promise.all(
        PLAN_CHILDREN.map((child) =>
            db
                .update(child)
                .set({ deletedAt: null, updatedAt: now })
                .where(
                    and(
                        eq(child.deletedAt, deletedAt),
                        inArray(
                            child.planId,
                            db.select({ id: installmentPlans.id }).from(installmentPlans).where(taken)
                        )
                    )
                )
        )
    );
    await db.update(installmentPlans).set({ deletedAt: null, updatedAt: now }).where(taken);
}

/** An account going takes its orders with it. */
export async function tombstonePlansOnAccount(db: Database, accountId: string, now: Date): Promise<void> {
    await tombstonePlans(db, eq(installmentPlans.accountId, accountId), now, true);
}
