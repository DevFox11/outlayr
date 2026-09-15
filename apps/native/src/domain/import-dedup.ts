import type { ImportEntry } from "@/data/transfer-core";
import { startOfDay } from "@/domain/dates";
import { merchantKey } from "@/domain/merchant-resolver";

export interface ExistingRow {
    amount: number;
    date: Date;
    income: boolean;
    note: string;
}

/**
 * Three decimals, not two: KWD, BHD, OMR, JOD, TND and LYD are 3-decimal
 * currencies, and rounding to 2 made two distinct purchases on the same day at
 * the same merchant — 12.341 and 12.344 — the same row, so the second was
 * flagged as a duplicate of a transaction it is not and the user skipped it.
 *
 * Still rounded rather than stringified raw, because that is what keeps an
 * amount that has been through arithmetic from missing its own match.
 */
export function dedupFingerprint(row: ExistingRow): string {
    return `${startOfDay(row.date).getTime()}|${row.amount.toFixed(3)}|${row.income ? 1 : 0}|${merchantKey(row.note)}`;
}

export function fingerprintsOf(rows: readonly ExistingRow[]): ReadonlySet<string> {
    return new Set(rows.map(dedupFingerprint));
}

export function flagDuplicates(entries: readonly ImportEntry[], existing: ReadonlySet<string>): ReadonlySet<number> {
    const flagged = new Set<number>();
    for (const [index, entry] of entries.entries()) {
        if (existing.has(dedupFingerprint(entry))) {
            flagged.add(index);
        }
    }
    return flagged;
}
