import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { DEFAULT_ACCOUNT_KIND } from "@/domain/account-kind";
import type { AccountKind } from "@/domain/account-kind";
import { canonicalUsd } from "@/domain/canonical-usd";
import { newId } from "@/domain/ids";

import { getMetaSync, META_KEYS, setMeta } from "./app-meta-core";
import { localRateLookup } from "./rates";
import { tombstoneTransfersTouchingAccount } from "./transfers-core";

export type Account = typeof accounts.$inferSelect;

export interface AccountInput {
    currency: string;
    customColor?: string | null;
    emoji?: string | null;
    icon?: string | null;
    imageColor?: string | null;
    imageKey?: string | null;
    imageUri?: string | null;
    initialBalance?: number;
    /** Defaults to now — the account starts holding this balance today. */
    initialBalanceDate?: Date;
    /** `asset` or `liability`; defaults to asset. See `domain/account-kind.ts`. */
    kind?: AccountKind;
    name: string;
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

export async function rememberLastUsedAccount(db: Database, id: string): Promise<void> {
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
async function frozenUsd(db: Database, amount: number, currency: string, date: Date): Promise<number | null> {
    if (amount === 0) {
        return 0;
    }
    const { amountUsd } = await canonicalUsd(localRateLookup(db), {
        amount: Math.abs(amount),
        currency,
        date,
        displayCurrency: currency,
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
            currency: input.currency,
            customColor: input.customColor ?? null,
            dateCreated: now,
            deletedAt: null,
            emoji: input.emoji ?? null,
            icon: input.icon ?? null,
            id,
            imageColor: input.imageColor ?? null,
            imageKey: input.imageKey ?? null,
            imageUri: input.imageUri ?? null,
            initialBalance,
            initialBalanceDate,
            initialBalanceUsd: await frozenUsd(db, initialBalance, input.currency, initialBalanceDate),
            kind: input.kind ?? DEFAULT_ACCOUNT_KIND,
            name: input.name,
            sortOrder: await nextSortOrder(db),
            updatedAt: now,
        });
        return id;
    },

    async listActive(db: Database): Promise<Account[]> {
        return await db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(accounts.sortOrder);
    },

    /** The caller supplies every live account already in the desired order. */
    async reorder(db: Database, orderedIds: string[]): Promise<void> {
        const now = new Date();
        await withTransaction(db, async () => {
            for (let index = 0; index < orderedIds.length; index += 1) {
                // oxlint-disable-next-line no-await-in-loop -- one expo-sqlite connection backs the surrounding withTransaction, so concurrent statements would interleave inside the same transaction
                await db
                    .update(accounts)
                    .set({ sortOrder: index, updatedAt: now })
                    .where(eq(accounts.id, orderedIds[index]));
            }
        });
    },

    /**
     * `transactions.accountId` declares `onDelete: "set null"`, which never fires
     * for a tombstone — so the detach the delete copy promises has to happen here,
     * or every entry keeps pointing at a row only the `deletedAt` filters hide.
     */
    async softDelete(db: Database, id: string, now: Date = new Date()): Promise<void> {
        await withTransaction(db, async () => {
            await tombstoneTransfersTouchingAccount(db, id, now);
            await db
                .update(accounts)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)));
            await db
                .update(transactions)
                .set({ accountId: null, updatedAt: now })
                .where(eq(transactions.accountId, id));
        });
    },

    async update(db: Database, id: string, patch: Partial<AccountInput>): Promise<void> {
        const existing = getAccountById(db, id);
        if (existing == null) {
            throw new Error("Account not found.");
        }

        const initialBalance = patch.initialBalance ?? existing.initialBalance;
        const currency = patch.currency ?? existing.currency;
        const initialBalanceDate = patch.initialBalanceDate ?? existing.initialBalanceDate;
        const moneyMoved =
            initialBalance !== existing.initialBalance ||
            currency !== existing.currency ||
            initialBalanceDate.getTime() !== existing.initialBalanceDate.getTime();

        // The twin of `removesPhoto` in transactions-core.ts: an account whose bytes
        // this device has not fetched also has a null path, so only a removal read
        // against the PREVIOUS path may clear the key.
        const removesLogo = existing.imageUri != null && "imageUri" in patch && patch.imageUri == null;

        await db
            .update(accounts)
            .set({
                ...patch,
                currency,
                imageKey: removesLogo ? null : patch.imageKey,
                initialBalance,
                initialBalanceDate,
                initialBalanceUsd: moneyMoved
                    ? await frozenUsd(db, initialBalance, currency, initialBalanceDate)
                    : existing.initialBalanceUsd,
                updatedAt: new Date(),
            })
            .where(eq(accounts.id, id));
    },
};
