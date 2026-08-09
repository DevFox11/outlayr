import { and, count, eq, isNull, or } from "drizzle-orm";
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
	/** Names the transfer it was charged for, so the log row is not a bare figure. */
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

/** The category the last fee was filed under, so the next one costs no question. */
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

export const transfersRepo = {
	/** Live transfers touching an account, for the delete confirmation's count. */
	async countForAccount(db: Database, accountId: string): Promise<number> {
		const [row] = await db
			.select({ total: count() })
			.from(transfers)
			.where(and(isNull(transfers.deletedAt), touchesAccount(accountId)));
		return row?.total ?? 0;
	},
	/**
	 * The fee is written as an ordinary expense carrying `transferId`, never as a
	 * column here — so every spending aggregate counts it exactly as it counts any
	 * other expense, and the legs stay a pure conversion of each other.
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

	/**
	 * A fee has no meaning without the transfer that produced it, so it is
	 * tombstoned in the same breath. Both rows are money the ledger has to stop
	 * counting at the same instant, or a balance is briefly wrong.
	 */
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

	/**
	 * Unlike a transaction, a transfer cannot be detached from a deleted account:
	 * both legs are `notNull`, and a leg pointing at an account that is gone would
	 * silently corrupt the surviving side's balance.
	 */
	async softDeleteForAccount(db: Database, accountId: string, now: Date = new Date()): Promise<void> {
		const doomed = await db
			.select({ id: transfers.id })
			.from(transfers)
			.where(and(isNull(transfers.deletedAt), touchesAccount(accountId)));
		for (const { id } of doomed) {
			// biome-ignore lint/performance/noAwaitInLoops: one expo-sqlite connection backs each withTransaction, so concurrent statements would interleave inside the same transaction
			await transfersRepo.softDelete(db, id, now);
		}
	},
};
