import { currencyTotals } from "@outlayr/money/currency-totals";
import type { CurrencyBucket } from "@outlayr/money/currency-totals";
import { utcDateString } from "@outlayr/money/dates";
import { isExact, valueRowsIn } from "@outlayr/money/valuation";
import type { RateTable } from "@outlayr/money/valuation";

import { DEFAULT_CURRENCY } from "./money";

export interface DayGroupable {
    amount: number;
    /** Frozen USD value, when the row has one. Absent leaves it unconvertible. */
    amountUsd?: number | null;
    /**
     * Null means the entry stated none — it was written under whatever the
     * ledger's currency was that day, which today's setting cannot be assumed to
     * match.
     */
    currency?: string | null;
    /**
     * The transaction's own instant, so it converts at that day's rate. `day` is
     * a local midnight and would land on the wrong side of UTC for half the world.
     */
    date?: Date;
    day: Date;
    /** Set on a transfer in the Log, where money moved between the user's own accounts is neither income nor spending. */
    excludedFromTotals?: boolean;
    feeForId?: string | null;
    id?: string;
    income: boolean;
    transferId?: string | null;
    /**
     * What the row is worth in its list's currency, stamped by {@link valueRows}.
     * Null when nothing can state it exactly; absent on a list valued without rates.
     */
    valued?: number | null;
}

export interface DaySection<T> {
    data: T[];
    day: Date;
    /**
     * Signed net for the day across every currency. Only meaningful when the day
     * used one — prefer {@link DaySection.totals}, which never adds two currencies
     * together.
     */
    total: number;
    /** The day's signed total per currency, dominant first. */
    totals: CurrencyBucket[];
}

export type WithFee<T> = T & { fee?: T };

/** A row as {@link valueRows} hands it back. */
export type Valued<T> = T & Pick<DayGroupable, "valued">;

const instant = (row: DayGroupable): number => (row.date ?? row.day).getTime();

function feeParent(row: DayGroupable): string | null {
    const parent = row.feeForId ?? row.transferId ?? null;
    return parent === row.id ? null : parent;
}

export function foldFees<T extends DayGroupable>(rows: readonly T[]): WithFee<T>[] {
    const ids = new Set(rows.map((row) => row.id));
    const fees = new Map<string, T>();
    for (const row of rows) {
        const parent = feeParent(row);
        if (parent !== null && ids.has(parent)) {
            fees.set(parent, row);
        }
    }
    return rows.flatMap((row) => {
        const parent = feeParent(row);
        if (parent !== null && fees.get(parent) === row) {
            return [];
        }
        const fee = row.id === undefined ? undefined : fees.get(row.id);
        return fee === undefined ? [row] : [{ ...row, fee }];
    });
}

/**
 * Stamps `valued` on the rows a list totals, handed out from the same
 * `(currency, UTC day, direction)` cells its header sums, so the rows add up to
 * the header to the cent. Without rates the rows come back as they were.
 */
export function valueRows<T extends DayGroupable>(
    rows: readonly T[],
    currency: string,
    rates: RateTable | undefined
): readonly Valued<T>[] {
    if (!rates) {
        return rows;
    }
    const counted = rows.filter((row) => !row.excludedFromTotals);
    const valuables = counted.map((row) => ({
        amount: row.amount,
        amountUsd: row.amountUsd ?? null,
        currency: row.currency ?? null,
        // The key `toCells` files the row under, so it lands in its header's cell.
        dateKey: row.date ? utcDateString(row.date.getTime()) : "",
        income: row.income,
    }));
    const values = valueRowsIn(valuables, currency, rates);
    const valued = new Map(
        counted.map((row, index): [T, number | null] => [
            row,
            isExact(valuables[index], currency, rates) ? values[index] : null,
        ])
    );
    return rows.map((row) => ({ ...row, valued: valued.get(row) ?? null }));
}

/**
 * Newest first, keyed on the local calendar day of the row's instant. The stored
 * `day` is midnight in whatever time zone the row was saved in, so keying on it
 * splits one day in two once the device's zone changes.
 */
export function groupByDay<T extends DayGroupable>(
    rows: readonly T[],
    globalCurrency: string = DEFAULT_CURRENCY,
    rates?: RateTable
): DaySection<WithFee<Valued<T>>>[] {
    const sections: DaySection<T>[] = [];
    const byDay = new Map<number, DaySection<T>>();
    for (const row of rows) {
        const key = new Date(instant(row)).setHours(0, 0, 0, 0);
        let section = byDay.get(key);
        if (!section) {
            section = { data: [], day: new Date(key), total: 0, totals: [] };
            byDay.set(key, section);
            sections.push(section);
        }
        section.data.push(row);
    }
    sections.sort((a, b) => b.day.getTime() - a.day.getTime());
    for (const section of sections) {
        section.data.sort((a, b) => instant(b) - instant(a));
        section.totals = currencyTotals(
            section.data.filter((row) => !row.excludedFromTotals),
            globalCurrency,
            rates
        );
        // Derived from the buckets rather than summed again over the rows, so the
        // one-currency case is the same number the section header prints, to the cent.
        let total = 0;
        for (const bucket of section.totals) {
            total += bucket.amount;
        }
        section.total = total;
    }
    return sections.map((section) => ({
        ...section,
        data: foldFees(valueRows(section.data, globalCurrency, rates)),
    }));
}
