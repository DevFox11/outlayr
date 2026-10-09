import { cellIsExact } from "@outlayr/money/account-balance";
import { valueCell } from "@outlayr/money/currency-totals";
import type { CurrencyCell } from "@outlayr/money/currency-totals";
import { utcDateString } from "@outlayr/money/dates";
import type { RateTable } from "@outlayr/money/valuation";

const HISTORY_DAYS = 182;

export interface AccountBalanceSeriesAccount {
    currency: string;
    initialBalance: number;
    initialBalanceDate: Date;
}

export interface AccountBalanceSeriesPoint {
    date: string;
    exact: boolean;
    value: number;
}

function addUtcDays(dateKey: string, days: number): string {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return utcDateString(date.getTime());
}

function applyCell(
    state: { exact: boolean; value: number },
    cell: CurrencyCell,
    currency: string,
    rates: RateTable
): void {
    state.value += (cell.income ? 1 : -1) * valueCell(cell, currency, rates);
    state.exact &&= cellIsExact(cell, currency, rates);
}

/**
 * Daily account balance points over the recent historical window. Entries that
 * predate the window become its opening value.
 */
export function accountBalanceSeries(
    account: AccountBalanceSeriesAccount,
    cells: readonly CurrencyCell[],
    rates: RateTable,
    now: Date,
    /**
     * Value the line in this currency instead of the account's own, with the
     * opening balance already converted into it.
     *
     * The single-account chart wants the account's own currency and its raw
     * opening; a sum across accounts cannot, or it would add bolivares to
     * dollars. Both readings come from one walk rather than two definitions of
     * "balance" that can drift apart.
     */
    valuedIn?: { currency: string; opening: number }
): AccountBalanceSeriesPoint[] {
    const currency = valuedIn === undefined ? account.currency : valuedIn.currency;
    const opening = valuedIn === undefined ? account.initialBalance : valuedIn.opening;
    const nowKey = utcDateString(now.getTime());
    const windowStart = addUtcDays(nowKey, -(HISTORY_DAYS - 1));
    const stampedOpening = utcDateString(account.initialBalanceDate.getTime());
    const openingDate = stampedOpening > nowKey ? nowKey : stampedOpening;
    let startDate = windowStart;
    if (account.initialBalance !== 0 && openingDate > windowStart) {
        startDate = openingDate;
    }
    const cellsByDate = new Map<string, CurrencyCell[]>();
    const state = { exact: true, value: 0 };

    if (openingDate < windowStart) {
        state.value += opening;
    }

    for (const cell of cells) {
        if (cell.dateKey < windowStart) {
            applyCell(state, cell, currency, rates);
            continue;
        }
        const onDate = cellsByDate.get(cell.dateKey);
        if (onDate) {
            onDate.push(cell);
        } else {
            cellsByDate.set(cell.dateKey, [cell]);
        }
    }

    for (let date = windowStart; date < startDate; date = addUtcDays(date, 1)) {
        for (const cell of cellsByDate.get(date) ?? []) {
            applyCell(state, cell, currency, rates);
        }
    }

    const series: AccountBalanceSeriesPoint[] = [];
    for (let date = startDate; date <= nowKey; date = addUtcDays(date, 1)) {
        if (date === openingDate) {
            state.value += opening;
        }
        for (const cell of cellsByDate.get(date) ?? []) {
            applyCell(state, cell, currency, rates);
        }
        series.push({ date, exact: state.exact, value: state.value });
    }
    return series;
}
