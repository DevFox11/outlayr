import { utcDateString } from "@outlayr/money/dates";

import { valueDatedRowsIn, valueExactIn } from "./valuation";
import type { RateTable } from "./valuation";

interface SpendingCalendarValuation {
    displayCurrency: string;
    rates: RateTable;
}

export interface SpendingCalendarRow {
    amount: number;
    amountUsd: number | null;
    currency: string | null;
    date: Date;
    exchangeRate?: number | null;
    exchangeRateType?: string | null;
    income: boolean;
    valuationDate: Date;
}

export interface SpendingCalendarEntry {
    date: string;
    exact: boolean;
    value: number;
}

function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function compareStrings(left: string, right: string): number {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}

function compareRows(left: SpendingCalendarRow, right: SpendingCalendarRow): number {
    const localDateComparison = compareStrings(localDateKey(left.date), localDateKey(right.date));
    if (localDateComparison !== 0) {
        return localDateComparison;
    }
    const valuationDateComparison = left.valuationDate.getTime() - right.valuationDate.getTime();
    if (valuationDateComparison !== 0) {
        return valuationDateComparison;
    }
    return compareStrings(left.currency ?? "", right.currency ?? "");
}

export function spendingCalendarEntries(
    rows: readonly SpendingCalendarRow[],
    valuation: SpendingCalendarValuation,
    now: Date
): SpendingCalendarEntry[] {
    const expenses = rows.filter((row) => !row.income && row.date.getTime() <= now.getTime()).sort(compareRows);
    const values = valueDatedRowsIn(
        expenses.map((row) => ({ ...row, date: row.valuationDate })),
        valuation.displayCurrency,
        valuation.rates
    );
    const totals = new Map<string, Omit<SpendingCalendarEntry, "date">>();

    for (let index = 0; index < expenses.length; index += 1) {
        const row = expenses[index];
        const date = localDateKey(row.date);
        const total = totals.get(date) ?? { exact: true, value: 0 };
        total.exact &&=
            valueExactIn(
                {
                    amount: row.amount,
                    amountUsd: row.amountUsd,
                    currency: row.currency,
                    dateKey: utcDateString(row.valuationDate.getTime()),
                    exchangeRate: row.exchangeRate,
                    exchangeRateType: row.exchangeRateType,
                },
                valuation.displayCurrency,
                valuation.rates
            ) !== null;
        total.value += values[index] ?? 0;
        totals.set(date, total);
    }

    return [...totals.entries()]
        .map(([date, { exact, value }]) => ({ date, exact, value }))
        .sort((left, right) => left.date.localeCompare(right.date));
}
