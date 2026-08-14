import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { Database } from "@/db/client";
import { accounts, appMeta, budgets, categories, mainBudget, transactions, transfers } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { ARCHIVE_FORMAT, ARCHIVE_TABLES, ARCHIVE_VERSION, decodeArchiveRow, encodeArchiveRow } from "@/domain/archive";
import type { ArchiveDocument, ArchiveRow, ArchiveTable, TableRow } from "@/domain/archive";

const TABLES = {
    accounts,
    appMeta,
    budgets,
    categories,
    mainBudget,
    transactions,
    transfers,
} satisfies Record<ArchiveTable, SQLiteTable>;

/**
 * Every row of every replicated table, tombstones included.
 *
 * Tombstones travel because they are data: a deletion the archive dropped would
 * come back as a live row the moment a peer that never saw it pushed again, and
 * the undo window restores from them too.
 */
export async function buildArchive(db: Database, now: Date): Promise<ArchiveDocument> {
    // SAFETY: filled for every `ARCHIVE_TABLES` member by the loop below, which
    // is the same union the type is keyed on.
    const tables = {} as Record<ArchiveTable, ArchiveRow[]>;
    await Promise.all(
        ARCHIVE_TABLES.map(async (table) => {
            const rows: TableRow[] = await db.select().from(TABLES[table]);
            tables[table] = rows.map((row) => encodeArchiveRow(row));
        })
    );
    return {
        exportedAt: now.getTime(),
        format: ARCHIVE_FORMAT,
        tables,
        version: ARCHIVE_VERSION,
    };
}

/**
 * Replaces the ledger with the archive's, in one transaction.
 *
 * A replace rather than a merge, and the whole thing in one transaction, because
 * the half-states are the danger: a restore that emptied the tables and then
 * failed would leave nothing at all, and one that merged would silently keep
 * rows the archive says were deleted.
 *
 * Deletion runs in reverse table order and insertion in forward order, so a row
 * never points at a parent that has not been written yet — the same reason
 * `ARCHIVE_TABLES` is ordered rather than alphabetical.
 */
export async function restoreArchive(db: Database, document: ArchiveDocument): Promise<number> {
    let written = 0;
    await withTransaction(db, async () => {
        for (const table of [...ARCHIVE_TABLES].reverse()) {
            // oxlint-disable-next-line no-await-in-loop -- children must be deleted before their parents, so the reversed ARCHIVE_TABLES order has to be walked one table at a time
            await db.delete(TABLES[table]);
        }
        for (const table of ARCHIVE_TABLES) {
            const rows = document.tables[table].map((row) => decodeArchiveRow(table, row));
            if (rows.length === 0) {
                continue;
            }
            // Chunked against SQLite's 999 bound variables. A ledger is unbounded and
            // a single insert of one is not.
            for (let from = 0; from < rows.length; from += ARCHIVE_INSERT_CHUNK) {
                const slice = rows.slice(from, from + ARCHIVE_INSERT_CHUNK);
                // oxlint-disable-next-line no-await-in-loop -- every statement here shares the one open withTransaction connection, and forward table order writes parents before the rows referencing them
                await db.insert(TABLES[table]).values(slice);
                written += slice.length;
            }
        }
    });
    return written;
}

/**
 * 999 bound variables per statement divided by the widest table's column count,
 * with room to spare rather than tuned to it — a column added later must not
 * quietly push a restore over the limit.
 */
const ARCHIVE_INSERT_CHUNK = 20;
