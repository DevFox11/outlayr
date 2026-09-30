import { roundMoney } from "@outlayr/money/round";

import { minorUnitsFor } from "./money";

export interface TransferLogSource {
    date: Date;
    day: Date;
    fromAccountId: string;
    fromAmount: number;
    fromAmountUsd: number | null;
    fromCurrency: string;
    id: string;
    note: string;
    toAccountId: string;
    toAmount: number;
    toAmountUsd: number | null;
    toCurrency: string;
}

export interface TransferLogFee {
    accountId: string | null;
    amount: number;
}

export interface TransferMove {
    arrived: number;
    arrivedCurrency: string;
    fee: { amount: number; currency: string } | null;
    sent: number;
}

export interface TransferLogRow {
    amount: number;
    amountUsd: number | null;
    categoryColor: null;
    categoryEmoji: null;
    categoryIcon: null;
    categoryId: null;
    categoryName: null;
    currency: string;
    customColor: null;
    date: Date;
    day: Date;
    emoji: null;
    exchangeRate: null;
    exchangeRateType: null;
    excludedFromTotals: true;
    feeForId: null;
    icon: null;
    id: string;
    imageColor: null;
    imageUri: null;
    income: boolean;
    moved?: TransferMove;
    note: string;
    recurringAnchorDay: number | null;
    recurringCoefficient: number;
    recurringEndDate: null;
    recurringType: number;
    transferId: string;
}

const UNKNOWN_ACCOUNT = "—";

function transferMove(transfer: TransferLogSource, fee: TransferLogFee | undefined): TransferMove {
    if (fee === undefined) {
        return {
            arrived: transfer.toAmount,
            arrivedCurrency: transfer.toCurrency,
            fee: null,
            sent: transfer.fromAmount,
        };
    }
    const atDestination = fee.accountId === transfer.toAccountId;
    const currency = atDestination ? transfer.toCurrency : transfer.fromCurrency;
    const decimals = minorUnitsFor(currency);
    return {
        arrived: atDestination ? roundMoney(transfer.toAmount - fee.amount, decimals) : transfer.toAmount,
        arrivedCurrency: transfer.toCurrency,
        fee: { amount: fee.amount, currency },
        sent: atDestination ? transfer.fromAmount : roundMoney(transfer.fromAmount + fee.amount, decimals),
    };
}

export function toTransferLogRow(
    transfer: TransferLogSource,
    accountNames: ReadonlyMap<string, string>,
    fees?: ReadonlyMap<string, TransferLogFee>
): TransferLogRow {
    const from = accountNames.get(transfer.fromAccountId) ?? UNKNOWN_ACCOUNT;
    const to = accountNames.get(transfer.toAccountId) ?? UNKNOWN_ACCOUNT;
    return {
        amount: transfer.fromAmount,
        amountUsd: transfer.fromAmountUsd,
        categoryColor: null,
        categoryEmoji: null,
        categoryIcon: null,
        categoryId: null,
        categoryName: null,
        currency: transfer.fromCurrency,
        customColor: null,
        date: transfer.date,
        day: transfer.day,
        emoji: null,
        exchangeRate: null,
        exchangeRateType: null,
        excludedFromTotals: true,
        feeForId: null,
        icon: null,
        id: transfer.id,
        imageColor: null,
        imageUri: null,
        income: false,
        moved: fees === undefined ? undefined : transferMove(transfer, fees.get(transfer.id)),
        note: transfer.note === "" ? `${from} → ${to}` : transfer.note,
        recurringAnchorDay: null,
        recurringCoefficient: 1,
        recurringEndDate: null,
        recurringType: 0,
        transferId: transfer.id,
    };
}

interface Recent {
    date: Date;
    day: Date;
}

/**
 * Both inputs are already newest-first, so this is the merge step of a merge
 * sort rather than a re-sort — the log's order is `(day desc, date desc)` and
 * re-sorting the whole list would cost the windowing that produced it.
 */
export function mergeByRecency<T extends Recent>(left: readonly T[], right: readonly T[]): T[] {
    const merged: T[] = [];
    let l = 0;
    let r = 0;
    while (l < left.length && r < right.length) {
        const a = left[l];
        const b = right[r];
        const byDay = b.day.getTime() - a.day.getTime();
        const takeLeft = byDay === 0 ? a.date.getTime() >= b.date.getTime() : byDay < 0;
        if (takeLeft) {
            merged.push(a);
            l += 1;
        } else {
            merged.push(b);
            r += 1;
        }
    }
    return [...merged, ...left.slice(l), ...right.slice(r)];
}
