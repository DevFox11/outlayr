import { toAccountKind } from "@outlayr/money/account-kind";
import { startOfDay } from "@outlayr/money/calendar";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, installmentPlans, installments, outsidePayments, transactions, transfers } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { planStanding } from "@/domain/installments";
import type { InstallmentStanding, PlanStanding, ScheduledInstallment } from "@/domain/installments";

import { getAccountById } from "./accounts-core";
import { frozenUsdAmount } from "./frozen-usd";
import { tombstonePlans } from "./installment-cascade";
import { transactionsRepo } from "./transactions-core";
import type { TransactionInput } from "./transactions-core";
import { stageTransfer } from "./transfers-core";

export type InstallmentPlan = typeof installmentPlans.$inferSelect;
export type Installment = typeof installments.$inferSelect;

/**
 * Where a payment comes from. The plan counts what ARRIVES on the liability
 * (`amount`, in its currency); `fromAmount` is what left the source in its own,
 * so a bolivar account paying a USD cuota at the day's rate is one transfer.
 */
export interface PaymentSource {
    exchangeRate: number | null;
    exchangeRateType: string | null;
    fromAccountId: string;
    /** Equal to the paid amount when the two currencies match. */
    fromAmount: number;
    fromCurrency: string;
    note?: string;
}

export interface InstallmentOrderInput {
    /** More writes for the purchase entry (its tags, its split), inside the order's transaction. */
    inSameTransaction?: (transactionId: string) => Promise<void>;
    /**
     * Installments 1..k already paid outside Outlayr, each on its due date (today
     * at the latest): an order started before it was recorded. Defaults to none.
     */
    installmentsPaidOutside?: number;
    /** The purchase entry, at full price, on the liability account, at its real date. */
    purchase: TransactionInput & { accountId: string };
    /** From `generateSchedule`, possibly edited. Must not be empty. */
    schedule: readonly ScheduledInstallment[];
    /**
     * Required when the schedule has an upfront row (sequence 0): the account it
     * was paid from, or `null` when it was paid outside Outlayr.
     */
    upfront?: PaymentSource | null;
}

export interface InstallmentPaymentInput {
    /** What reaches the liability, in the plan's currency. */
    amount: number;
    date: Date;
    planId: string;
    /** `null` records it as paid outside Outlayr: nothing leaves an account. */
    source: PaymentSource | null;
}

function liabilityAccount(db: Database, accountId: string) {
    const account = getAccountById(db, accountId);
    if (!account || toAccountKind(account.kind) !== "liability") {
        throw new Error("Installments are only allowed on liability accounts");
    }
    return account;
}

function livePlan(db: Database, planId: string): InstallmentPlan {
    const [plan] = db
        .select()
        .from(installmentPlans)
        .where(and(eq(installmentPlans.id, planId), isNull(installmentPlans.deletedAt)))
        .limit(1)
        .all();
    if (!plan) {
        throw new Error("The installment order no longer exists");
    }
    return plan;
}

function paymentTransfer(
    planId: string,
    accountId: string,
    currency: string,
    payment: {
        amount: number;
        date: Date;
        source: PaymentSource;
    }
) {
    return {
        date: payment.date,
        exchangeRate: payment.source.exchangeRate,
        exchangeRateType: payment.source.exchangeRateType,
        fromAccountId: payment.source.fromAccountId,
        fromAmount: payment.source.fromAmount,
        fromCurrency: payment.source.fromCurrency,
        installmentPlanId: planId,
        note: payment.source.note,
        toAccountId: accountId,
        toAmount: payment.amount,
        toCurrency: currency,
    };
}

/** `outsidePayments` rows, valued before any transaction opens, as `stageTransfer` does. */
function outsideRows(
    db: Database,
    planId: string,
    currency: string,
    payments: readonly { amount: number; date: Date }[],
    now: Date
) {
    return Promise.all(
        payments.map(async ({ amount, date }) => ({
            amount,
            amountUsd: await frozenUsdAmount(db, amount, currency, date),
            date,
            id: newId(),
            planId,
            updatedAt: now,
        }))
    );
}

export const installmentsRepo = {
    /**
     * Writes an order in one transaction: the purchase on the liability account
     * at full price, the plan, its rows, the upfront as a transfer from
     * `upfront.fromAccountId` dated the purchase day (or paid outside), and any
     * installments already paid outside. Answers the plan and purchase ids.
     */
    async createOrder(db: Database, input: InstallmentOrderInput): Promise<{ planId: string; transactionId: string }> {
        const { purchase, schedule } = input;
        const account = liabilityAccount(db, purchase.accountId);
        if (purchase.income) {
            throw new Error("An installment purchase is an expense");
        }
        if (schedule.length === 0 || schedule.some((row) => !(row.amount > 0))) {
            throw new Error("An installment order needs positive installments");
        }
        const planId = newId();
        const now = new Date();
        const upfrontRow = schedule.find((row) => row.sequence === 0);
        const paidOutside = input.installmentsPaidOutside ?? 0;
        const cuotas = schedule.filter((row) => row.sequence > 0).sort((a, b) => a.sequence - b.sequence);
        if (!(Number.isInteger(paidOutside) && paidOutside >= 0 && paidOutside <= cuotas.length)) {
            throw new Error("Installments paid outside must be a whole number within the schedule");
        }
        if (upfrontRow && input.upfront === undefined) {
            throw new Error("An upfront payment needs the account it was paid from, or null when paid outside");
        }
        const outside = await outsideRows(
            db,
            planId,
            account.currency,
            [
                ...(upfrontRow && input.upfront === null ? [{ amount: upfrontRow.amount, date: purchase.date }] : []),
                ...cuotas.slice(0, paidOutside).map((row) => ({
                    amount: row.amount,
                    date: new Date(Math.min(startOfDay(row.dueDate).getTime(), now.getTime())),
                })),
            ],
            now
        );
        let upfront: Awaited<ReturnType<typeof stageTransfer>> | null = null;
        if (upfrontRow && input.upfront) {
            upfront = await stageTransfer(
                db,
                paymentTransfer(planId, account.id, account.currency, {
                    amount: upfrontRow.amount,
                    date: purchase.date,
                    source: input.upfront,
                })
            );
        }

        const purchaseId = await transactionsRepo.create(db, purchase, {
            inSameTransaction: async (transactionId) => {
                await db.insert(installmentPlans).values({
                    accountId: account.id,
                    dateCreated: now,
                    id: planId,
                    transactionId,
                    updatedAt: now,
                });
                await db.insert(installments).values(
                    schedule.map((row) => ({
                        amount: row.amount,
                        dueDate: startOfDay(row.dueDate),
                        id: newId(),
                        planId,
                        sequence: row.sequence,
                        updatedAt: now,
                    }))
                );
                if (outside.length > 0) {
                    await db.insert(outsidePayments).values(outside);
                }
                await upfront?.write();
                await input.inSameTransaction?.(transactionId);
            },
        });
        return { planId, transactionId: purchaseId };
    },

    /** Removes one row; the rest of the schedule stays as it is. */
    async deleteInstallment(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await db
            .update(installments)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(installments.id, id), isNull(installments.deletedAt)));
    },

    /** Undoes one payment made outside Outlayr. */
    async deleteOutsidePayment(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await db
            .update(outsidePayments)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(outsidePayments.id, id), isNull(outsidePayments.deletedAt)));
    },

    /** Removes an order with its rows and outside payments. Its transfers stay, as plain transfers. */
    async deletePlan(db: Database, planId: string, now: Date = new Date()): Promise<void> {
        await withTransaction(db, async () => {
            await tombstonePlans(db, eq(installmentPlans.id, planId), now, true);
        });
    },

    /**
     * Records a payment toward an order: a transfer to its liability account, or
     * with `source: null` an outside payment. Answers the new row's id.
     */
    async recordPayment(db: Database, input: InstallmentPaymentInput): Promise<string> {
        const plan = livePlan(db, input.planId);
        const account = liabilityAccount(db, plan.accountId);
        const { source } = input;
        if (source === null) {
            if (!(input.amount > 0)) {
                throw new Error("A payment must be positive");
            }
            const [row] = await outsideRows(db, plan.id, account.currency, [input], new Date());
            if (!row) {
                throw new Error("No outside payment to record");
            }
            await db.insert(outsidePayments).values(row);
            return row.id;
        }
        const { id, write } = await stageTransfer(
            db,
            paymentTransfer(plan.id, account.id, account.currency, { ...input, source })
        );
        await withTransaction(db, write);
        return id;
    },

    /** Moves one row's due date or changes its amount, as a provider does. */
    async updateInstallment(
        db: Database,
        id: string,
        patch: { amount?: number; dueDate?: Date },
        now: Date = new Date()
    ): Promise<void> {
        if (patch.amount !== undefined && !(patch.amount > 0)) {
            throw new Error("An installment must be positive");
        }
        await db
            .update(installments)
            .set({
                ...(patch.amount !== undefined && { amount: patch.amount }),
                ...(patch.dueDate !== undefined && { dueDate: startOfDay(patch.dueDate) }),
                updatedAt: now,
            })
            .where(and(eq(installments.id, id), isNull(installments.deletedAt)));
    },
};

/** Live orders with their account's currency, which every amount on them is in. */
export function livePlansQuery(db: Database, accountId?: string) {
    return db
        .select({
            accountId: installmentPlans.accountId,
            currency: accounts.currency,
            dateCreated: installmentPlans.dateCreated,
            id: installmentPlans.id,
            transactionId: installmentPlans.transactionId,
        })
        .from(installmentPlans)
        .innerJoin(accounts, eq(accounts.id, installmentPlans.accountId))
        .where(
            and(
                isNull(installmentPlans.deletedAt),
                accountId === undefined ? undefined : eq(installmentPlans.accountId, accountId)
            )
        )
        .orderBy(asc(installmentPlans.dateCreated));
}

export function liveInstallmentsQuery(db: Database) {
    return db
        .select({
            amount: installments.amount,
            dueDate: installments.dueDate,
            id: installments.id,
            planId: installments.planId,
            sequence: installments.sequence,
        })
        .from(installments)
        .where(isNull(installments.deletedAt));
}

/**
 * What each order has been paid: the `toAmount` of its live transfers, already
 * in the plan's currency. Only transfers that still arrive on the order's
 * account count, so one re-pointed elsewhere in the editor stops paying it.
 */
export function planPaymentsQuery(db: Database) {
    return db
        .select({ paid: sql<number>`sum(${transfers.toAmount})`, planId: installmentPlans.id })
        .from(transfers)
        .innerJoin(
            installmentPlans,
            and(
                eq(installmentPlans.id, transfers.installmentPlanId),
                eq(installmentPlans.accountId, transfers.toAccountId)
            )
        )
        .where(and(isNull(transfers.deletedAt), isNotNull(transfers.installmentPlanId)))
        .groupBy(installmentPlans.id);
}

/** Live payments made outside Outlayr, which count toward their order like its transfers. */
export function liveOutsidePaymentsQuery(db: Database) {
    return db
        .select({
            amount: outsidePayments.amount,
            date: outsidePayments.date,
            id: outsidePayments.id,
            planId: outsidePayments.planId,
        })
        .from(outsidePayments)
        .where(isNull(outsidePayments.deletedAt))
        .orderBy(asc(outsidePayments.date));
}

/** The purchase entries behind orders, for their name and price. */
export function planPurchasesQuery(db: Database) {
    return db
        .select({ amount: transactions.amount, date: transactions.date, id: transactions.id, note: transactions.note })
        .from(transactions)
        .innerJoin(installmentPlans, eq(installmentPlans.transactionId, transactions.id))
        .where(isNull(installmentPlans.deletedAt));
}

type RowOf<Query extends (db: Database) => { all: () => unknown[] }> = ReturnType<ReturnType<Query>["all"]>[number];
export type PlanRow = RowOf<typeof livePlansQuery>;
export type InstallmentRow = RowOf<typeof liveInstallmentsQuery>;
type PaymentRow = RowOf<typeof planPaymentsQuery>;
export type OutsidePaymentRow = RowOf<typeof liveOutsidePaymentsQuery>;
export type PurchaseRow = RowOf<typeof planPurchasesQuery>;

export interface PlanWithStanding {
    /** Oldest first, so one can be undone on its own. */
    outsidePayments: OutsidePaymentRow[];
    plan: PlanRow;
    /** Null only while the purchase entry is missing on this device, e.g. mid-sync. */
    purchase: PurchaseRow | null;
    standing: PlanStanding<InstallmentRow>;
}

export interface UpcomingInstallment {
    accountId: string;
    currency: string;
    planId: string;
    purchase: PurchaseRow | null;
    standing: InstallmentStanding<InstallmentRow>;
}

/** Joins the reads into each order's derived standing as of `today`. */
export function assemblePlans(
    reads: {
        installments: readonly InstallmentRow[];
        outside: readonly OutsidePaymentRow[];
        payments: readonly PaymentRow[];
        plans: readonly PlanRow[];
        purchases: readonly PurchaseRow[];
    },
    today: Date
): PlanWithStanding[] {
    const rowsByPlan = new Map<string, InstallmentRow[]>();
    for (const row of reads.installments) {
        rowsByPlan.set(row.planId, [...(rowsByPlan.get(row.planId) ?? []), row]);
    }
    const outsideByPlan = new Map<string, OutsidePaymentRow[]>();
    for (const row of reads.outside) {
        outsideByPlan.set(row.planId, [...(outsideByPlan.get(row.planId) ?? []), row]);
    }
    const paidByPlan = new Map(reads.payments.map((row) => [row.planId, row.paid]));
    const purchases = new Map(reads.purchases.map((row) => [row.id, row]));
    return reads.plans.map((plan) => {
        const outside = outsideByPlan.get(plan.id) ?? [];
        const paid = outside.reduce((total, row) => total + row.amount, paidByPlan.get(plan.id) ?? 0);
        return {
            outsidePayments: outside,
            plan,
            purchase: purchases.get(plan.transactionId) ?? null,
            standing: planStanding(rowsByPlan.get(plan.id) ?? [], paid, today, plan.currency),
        };
    });
}

/**
 * Every installment not fully covered and due on or before `through`, soonest
 * first, across the orders given. Overdue rows are included (flagged), since a
 * "due soon" list that hid a missed payment would be the wrong kind of calm.
 */
export function upcomingInstallments(plans: readonly PlanWithStanding[], through: Date): UpcomingInstallment[] {
    const throughMs = startOfDay(through).getTime();
    return plans
        .flatMap(({ plan, purchase, standing }) =>
            standing.rows
                .filter((row) => row.status !== "paid" && row.row.dueDate.getTime() <= throughMs)
                .map((row) => ({
                    accountId: plan.accountId,
                    currency: plan.currency,
                    planId: plan.id,
                    purchase,
                    standing: row,
                }))
        )
        .sort((a, b) => a.standing.row.dueDate.getTime() - b.standing.row.dueDate.getTime());
}

/** Every live order (or one account's) with its standing, read once. */
export function readPlans(db: Database, today: Date, accountId?: string): PlanWithStanding[] {
    return assemblePlans(
        {
            installments: liveInstallmentsQuery(db).all(),
            outside: liveOutsidePaymentsQuery(db).all(),
            payments: planPaymentsQuery(db).all(),
            plans: livePlansQuery(db, accountId).all(),
            purchases: planPurchasesQuery(db).all(),
        },
        today
    );
}
