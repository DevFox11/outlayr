import { startOfDay } from "@outlayr/money/calendar";

import type { ImportEntry } from "@/data/transfer-core";
import { merchantKey } from "@/domain/merchant-resolver";

export interface ExistingRow {
    amount: number;
    date: Date;
    income: boolean;
    note: string;
}

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
