import type { EntryRateType } from "@outlayr/money/rates";

import type { Database } from "@/db/client";
import { debtLegs } from "@/domain/debts";
import type { DebtVerb } from "@/domain/debts";
import { roundToMinorUnits } from "@/domain/money";

import { accountsRepo } from "./accounts-core";
import { transactionsRepo } from "./transactions-core";
import { transfersRepo } from "./transfers-core";
import type { TransferInput } from "./transfers-core";

export interface PersonInput {
    currency: string;
    name: string;
    /**
     * A debt from before Outlayr, signed the way the balance is: negative when
     * you owe them, positive when they owe you. Defaults to zero.
     */
    openingBalance?: number;
}

/** A person is an account of kind `person`, with no logo or institution identity. */
export async function createPerson(db: Database, input: PersonInput): Promise<string> {
    return await accountsRepo.create(db, {
        currency: input.currency,
        initialBalance: roundToMinorUnits(input.openingBalance ?? 0, input.currency),
        kind: "person",
        name: input.name.trim(),
    });
}

/** One side of a debt movement, in that account's own currency. */
export interface DebtLeg {
    accountId: string;
    amount: number;
    currency: string;
}

export interface DebtMovementInput {
    /** One of your accounts. */
    account: DebtLeg;
    date: Date;
    note?: string;
    person: DebtLeg;
    /** How a cross-currency amount was valued; ignored when both legs share a currency. */
    rateType: EntryRateType | null;
    verb: DebtVerb;
}

/**
 * The transfer a debt movement is. Each leg arrives already in its account's
 * currency, as the transfer editor's legs do, and the stored rate is the one
 * those legs imply, so a cross-currency debt reads back exactly as it was typed.
 */
export function debtTransferInput(input: DebtMovementInput): TransferInput {
    const { from, to } = debtLegs(input.verb, { account: input.account, person: input.person });
    const crossCurrency = from.currency !== to.currency;
    return {
        date: input.date,
        exchangeRate: crossCurrency ? to.amount / from.amount : 1,
        exchangeRateType: crossCurrency ? input.rateType : null,
        fromAccountId: from.accountId,
        fromAmount: from.amount,
        fromCurrency: from.currency,
        note: input.note ?? "",
        toAccountId: to.accountId,
        toAmount: to.amount,
        toCurrency: to.currency,
    };
}

/** Borrowing, lending, paying back or being paid back: a transfer with a person. Returns the transfer id. */
export async function recordDebtMovement(db: Database, input: DebtMovementInput): Promise<string> {
    return await transfersRepo.create(db, debtTransferInput(input));
}

export interface SoldOnCreditInput {
    amount: number;
    categoryId: string;
    date: Date;
    note?: string;
    /** The buyer, whose currency the sale is in. */
    person: { currency: string; id: string };
}

/**
 * Fiado: an income entry on the person's account, so it counts as income once
 * and leaves them owing you. Being paid back later is a transfer, not income.
 */
export async function recordSoldOnCredit(db: Database, input: SoldOnCreditInput): Promise<string> {
    return await transactionsRepo.create(db, {
        accountId: input.person.id,
        amount: input.amount,
        categoryId: input.categoryId,
        currency: input.person.currency,
        date: input.date,
        details: input.note ?? null,
        income: true,
        note: "",
    });
}
