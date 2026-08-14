import { and, count, eq, inArray, isNull, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions, transfers } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { canonicalUsd } from "@/domain/canonical-usd";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { newId } from "@/domain/ids";
import type { FeeSide } from "@/domain/transfer-reconcile";

import { getMetaSync, META_KEYS, setMeta } from "./app-meta-core";
import { localRateLookup } from "./rates";

export interface TransferFeeInput {
    amount: number;
    categoryId: string | null;
    note?: string;
    side: FeeSide;
}

export interface TransferInput {
    date: Date;
    exchangeRate: number | null;
    exchangeRateType: string | null;
    fee?: TransferFeeInput;
    fromAccountId: string;
    fromAmount: number;
    fromCurrency: string;
    note?: string;
    toAccountId: string;
    toAmount: number;
    toCurrency: string;
}

export type Transfer = typeof transfers.$inferSelect;

export function lastFeeCategoryId(db: Database): string | null {
    return getMetaSync(db, META_KEYS.lastTransferFeeCategory);
}

export async function rememberFeeCategory(db: Database, categoryId: string): Promise<void> {
    await setMeta(db, META_KEYS.lastTransferFeeCategory, categoryId);
}

async function frozenUsd(db: Database, amount: number, currency: string, date: Date): Promise<number | null> {
    const { amountUsd } = await canonicalUsd(localRateLookup(db), {
        amount,
        currency,
        date,
        displayCurrency: currency,
    });
    return amountUsd ?? null;
}

function assertMovable(input: TransferInput): void {
    if (input.fromAccountId === input.toAccountId) {
        throw new Error("A transfer cannot leave and arrive at the same account");
    }
    if (!(input.fromAmount > 0 && input.toAmount > 0)) {
        throw new Error("Both transfer legs must be positive");
    }
}

function touchesAccount(accountId: string) {
    return or(eq(transfers.fromAccountId, accountId), eq(transfers.toAccountId, accountId));
}

/**
 * Statements only, no transaction of its own: `withTransactionAsync` does not
 * nest (`db/transaction.ts`), so the account delete this belongs to has to
 * supply the transaction — one opened here splits the cascade into a commit each.
 */
export async function tombstoneTransfersTouchingAccount(db: Database, accountId: string, now: Date): Promise<void> {
    const doomed = db
        .select({ id: transfers.id })
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), touchesAccount(accountId)));
    await db
        .update(transactions)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(isNull(transactions.deletedAt), inArray(transactions.transferId, doomed)));
    await db
        .update(transfers)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(isNull(transfers.deletedAt), touchesAccount(accountId)));
}

export const transfersRepo = {
    async countForAccount(db: Database, accountId: string): Promise<number> {
        const [row] = await db
            .select({ total: count() })
            .from(transfers)
            .where(and(isNull(transfers.deletedAt), touchesAccount(accountId)));
        return row?.total ?? 0;
    },
    /**
     * Each leg freezes at its own market rate, so a transfer struck away from the
     * market moves net worth by the spread — which is what happened. Receiving
     * 6000 Bs for $100 when the market pays 5550 is $8.11 earned, and pinning both
     * legs to the source would deny it.
     */
    async create(db: Database, input: TransferInput): Promise<string> {
        assertMovable(input);
        const now = new Date();
        const id = newId();
        const feeCurrency = input.fee?.side === "destination" ? input.toCurrency : input.fromCurrency;
        const [fromAmountUsd, toAmountUsd, feeUsd] = await Promise.all([
            frozenUsd(db, input.fromAmount, input.fromCurrency, input.date),
            frozenUsd(db, input.toAmount, input.toCurrency, input.date),
            input.fee ? frozenUsd(db, input.fee.amount, feeCurrency, input.date) : Promise.resolve(null),
        ]);

        await withTransaction(db, async () => {
            await db.insert(transfers).values({
                date: input.date,
                dateCreated: now,
                day: startOfDay(input.date),
                deletedAt: null,
                exchangeRate: input.exchangeRate,
                exchangeRateType: input.exchangeRateType,
                fromAccountId: input.fromAccountId,
                fromAmount: input.fromAmount,
                fromAmountUsd,
                fromCurrency: input.fromCurrency,
                id,
                month: firstOfMonth(input.date),
                note: input.note ?? "",
                toAccountId: input.toAccountId,
                toAmount: input.toAmount,
                toAmountUsd,
                toCurrency: input.toCurrency,
                updatedAt: now,
            });
            if (input.fee) {
                await db.insert(transactions).values({
                    accountId: input.fee.side === "destination" ? input.toAccountId : input.fromAccountId,
                    amount: input.fee.amount,
                    amountUsd: feeUsd,
                    categoryId: input.fee.categoryId,
                    currency: feeCurrency,
                    date: input.date,
                    day: startOfDay(input.date),
                    id: newId(),
                    income: false,
                    month: firstOfMonth(input.date),
                    note: input.fee.note ?? "",
                    transferId: id,
                    updatedAt: now,
                });
            }
        });
        return id;
    },

    async getById(db: Database, id: string): Promise<Transfer | null> {
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id)).limit(1);
        return row ?? null;
    },

    async listActive(db: Database): Promise<Transfer[]> {
        return await db.select().from(transfers).where(isNull(transfers.deletedAt)).orderBy(transfers.date);
    },

    async softDelete(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await withTransaction(db, async () => {
            await db
                .update(transfers)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(transfers.id, id), isNull(transfers.deletedAt)));
            await db
                .update(transactions)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(transactions.transferId, id), isNull(transactions.deletedAt)));
        });
    },
};
