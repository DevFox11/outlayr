import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";
import { getMetaSync, META_KEYS, setMeta } from "./app-meta-core";
import { localRateLookup } from "./rates";

export type Account = typeof accounts.$inferSelect;

export interface AccountInput {
	name: string;
	currency: string;
	initialBalance?: number;
	/** Defaults to now — the account starts holding this balance today. */
	initialBalanceDate?: Date;
	icon?: string | null;
	emoji?: string | null;
	customColor?: string | null;
	imageColor?: string | null;
	imageUri?: string | null;
	imageKey?: string | null;
}

export function getAccountById(db: Database, id: string): Account | null {
	const rows = db
		.select()
		.from(accounts)
		.where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
		.limit(1)
		.all();
	return rows[0] ?? null;
}

/**
 * A tombstoned account resolves to null here through {@link getAccountById},
 * so the default quietly falls back to none rather than reviving a deleted
 * account on the next entry.
 */
export function getLastUsedAccount(db: Database): Account | null {
	const id = getMetaSync(db, META_KEYS.lastTransactionAccount);
	return id == null ? null : getAccountById(db, id);
}

export async function rememberLastUsedAccount(
	db: Database,
	id: string,
): Promise<void> {
	await setMeta(db, META_KEYS.lastTransactionAccount, id);
}

async function nextSortOrder(db: Database): Promise<number> {
	const rows = await db
		.select({ sortOrder: accounts.sortOrder })
		.from(accounts)
		.where(isNull(accounts.deletedAt))
		.orderBy(desc(accounts.sortOrder))
		.limit(1);
	const last = rows[0]?.sortOrder;
	return last == null ? 0 : last + 1;
}

/**
 * The opening balance's USD value, frozen at the rate of its own day — the
 * contract `transactions.amountUsd` keeps. Signed, unlike an entry: an account
 * can open overdrawn, so the magnitude is canonicalized and the sign restored.
 */
async function frozenUsd(
	db: Database,
	amount: number,
	currency: string,
	date: Date,
): Promise<number | null> {
	if (amount === 0) {
		return 0;
	}
	const { amountUsd } = await canonicalUsd(localRateLookup(db), {
		amount: Math.abs(amount),
		currency,
		displayCurrency: currency,
		date,
	});
	return amountUsd == null ? null : Math.sign(amount) * amountUsd;
}

export const accountsRepo = {
	async create(db: Database, input: AccountInput): Promise<string> {
		const now = new Date();
		const id = newId();
		const initialBalance = input.initialBalance ?? 0;
		const initialBalanceDate = input.initialBalanceDate ?? now;
		await db.insert(accounts).values({
			id,
			name: input.name,
			currency: input.currency,
			initialBalance,
			initialBalanceUsd: await frozenUsd(
				db,
				initialBalance,
				input.currency,
				initialBalanceDate,
			),
			initialBalanceDate,
			icon: input.icon ?? null,
			emoji: input.emoji ?? null,
			customColor: input.customColor ?? null,
			imageColor: input.imageColor ?? null,
			imageUri: input.imageUri ?? null,
			imageKey: input.imageKey ?? null,
			sortOrder: await nextSortOrder(db),
			dateCreated: now,
			updatedAt: now,
			deletedAt: null,
		});
		return id;
	},

	async update(
		db: Database,
		id: string,
		patch: Partial<AccountInput>,
	): Promise<void> {
		const existing = getAccountById(db, id);
		if (existing == null) {
			throw new Error("Account not found.");
		}

		const initialBalance = patch.initialBalance ?? existing.initialBalance;
		const currency = patch.currency ?? existing.currency;
		const initialBalanceDate =
			patch.initialBalanceDate ?? existing.initialBalanceDate;
		const moneyMoved =
			initialBalance !== existing.initialBalance ||
			currency !== existing.currency ||
			initialBalanceDate.getTime() !== existing.initialBalanceDate.getTime();

		// The twin of `removesPhoto` in transactions-core.ts: an account whose bytes
		// this device has not fetched also has a null path, so only a removal read
		// against the PREVIOUS path may clear the key.
		const removesLogo =
			existing.imageUri != null &&
			"imageUri" in patch &&
			patch.imageUri == null;

		await db
			.update(accounts)
			.set({
				...patch,
				...(removesLogo ? { imageKey: null } : {}),
				initialBalance,
				currency,
				initialBalanceDate,
				initialBalanceUsd: moneyMoved
					? await frozenUsd(db, initialBalance, currency, initialBalanceDate)
					: existing.initialBalanceUsd,
				updatedAt: new Date(),
			})
			.where(eq(accounts.id, id));
	},

	async softDelete(
		db: Database,
		id: string,
		now: Date = new Date(),
	): Promise<void> {
		await db
			.update(accounts)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(accounts.id, id), isNull(accounts.deletedAt)));
	},

	/** The caller supplies every live account already in the desired order. */
	async reorder(db: Database, orderedIds: string[]): Promise<void> {
		const now = new Date();
		await withTransaction(db, async () => {
			for (let index = 0; index < orderedIds.length; index++) {
				await db
					.update(accounts)
					.set({ sortOrder: index, updatedAt: now })
					.where(eq(accounts.id, orderedIds[index]));
			}
		});
	},

	async listActive(db: Database): Promise<Account[]> {
		return await db
			.select()
			.from(accounts)
			.where(isNull(accounts.deletedAt))
			.orderBy(accounts.sortOrder);
	},
};
