import { currencyTotals } from "./currency-totals";
import type { CurrencyBucket } from "./currency-totals";
import { DEFAULT_CURRENCY } from "./money";
import type { RateTable } from "./valuation";

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
    /** Set on a transfer leg: money moved between the user's own accounts is neither income nor spending. */
    excludedFromTotals?: boolean;
    income: boolean;
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

/**
 * The JS mirror of Swift's `SectionedFetchRequest<Date?, Transaction>` keyed on
 * `\.day`. Sections follow first appearance rather than being re-sorted, so a
 * day-descending query stays day-descending and a caller can order the list
 * however it queried it.
 */
export function groupByDay<T extends DayGroupable>(
    rows: readonly T[],
    globalCurrency: string = DEFAULT_CURRENCY,
    rates?: RateTable
): DaySection<T>[] {
    const sections: DaySection<T>[] = [];
    const byDay = new Map<number, DaySection<T>>();
    for (const row of rows) {
        const key = row.day.getTime();
        let section = byDay.get(key);
        if (!section) {
            section = { data: [], day: new Date(row.day), total: 0, totals: [] };
            byDay.set(key, section);
            sections.push(section);
        }
        section.data.push(row);
    }
    for (const section of sections) {
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
    return sections;
}
