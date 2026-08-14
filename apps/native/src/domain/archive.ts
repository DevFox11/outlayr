import { z } from "zod";

/**
 * The shape of a full-ledger archive, and the rules for reading one back.
 *
 * Separate from the CSV entirely. A CSV is an interchange format for
 * spreadsheets and is lossy by design — six columns of a table that has thirty.
 * This is the format that exists to be restored from, so it carries every column
 * of every table verbatim and refuses anything it cannot vouch for.
 */

/** Rises only when an older file can no longer be read as written. */
export const ARCHIVE_VERSION = 1;

export const ARCHIVE_FORMAT = "outlayr.archive";

/**
 * Every table an archive carries, in the order a restore must write them:
 * `categories` first because transactions and budgets point at it, and a restore
 * into a schema with foreign keys enforced fails otherwise.
 */
export const ARCHIVE_TABLES = [
    "categories",
    "accounts",
    "transfers",
    "transactions",
    "budgets",
    "mainBudget",
    "appMeta",
] as const;

export type ArchiveTable = (typeof ARCHIVE_TABLES)[number];

/**
 * Which columns hold an instant.
 *
 * They are written as epoch milliseconds rather than left to `JSON.stringify`,
 * which would turn a `Date` into an ISO string and read it back as a plain
 * string — every date in the ledger silently becoming text that sorts and
 * compares differently. Naming them is what makes the round trip exact.
 */
export interface ArchiveDateColumns {
    accounts: readonly string[];
    appMeta: readonly string[];
    budgets: readonly string[];
    categories: readonly string[];
    mainBudget: readonly string[];
    transactions: readonly string[];
    transfers: readonly string[];
}

export const ARCHIVE_DATE_COLUMNS: ArchiveDateColumns = {
    accounts: ["initialBalanceDate", "dateCreated", "updatedAt", "deletedAt"],
    appMeta: [],
    budgets: ["startDate", "dateCreated", "updatedAt", "deletedAt"],
    categories: ["dateCreated", "updatedAt", "deletedAt"],
    mainBudget: ["startDate", "dateCreated", "updatedAt", "deletedAt"],
    transactions: ["date", "day", "month", "recurringEndDate", "updatedAt", "deletedAt"],
    transfers: ["date", "day", "month", "dateCreated", "updatedAt", "deletedAt"],
};

/** What a column can be once it is JSON. `Date` is encoded away before this. */
export type ArchiveValue = boolean | number | string | null;

/** A row as the file holds it. */
export type ArchiveRow = Record<string, ArchiveValue>;

/** A row as the database holds it — the same values, with instants still `Date`. */
export type TableRow = Record<string, ArchiveValue | Date>;

export interface ArchiveDocument {
    /** Epoch ms, for the same reason every other instant here is. */
    exportedAt: number;
    format: typeof ARCHIVE_FORMAT;
    tables: Record<ArchiveTable, ArchiveRow[]>;
    version: number;
}

export function archiveFileName(now: Date): string {
    const stamp = now.toISOString().slice(0, 10);
    return `outlayr-archive-${stamp}.json`;
}

/** Instants out to epoch ms, so nothing depends on how JSON renders a Date. */
export function encodeArchiveRow(row: TableRow): ArchiveRow {
    // Every `Date` encodes, not just the listed ones: the list decides what
    // decodes BACK to a Date, and letting an unlisted one fall through would
    // hand `JSON.stringify` an ISO string that restores as text.
    return Object.fromEntries(
        Object.entries(row).map(([column, value]) => [column, value instanceof Date ? value.getTime() : value])
    );
}

/**
 * The inverse. A date column holding something that is not a finite number
 * decodes to null rather than to `new Date(NaN)`, which would restore a row
 * whose date throws the moment anything formats it.
 */
export function decodeArchiveRow(table: ArchiveTable, row: ArchiveRow): TableRow {
    const dateColumns = ARCHIVE_DATE_COLUMNS[table];
    return Object.fromEntries(
        Object.entries(row).map(([column, value]) => {
            if (!dateColumns.includes(column)) {
                return [column, value];
            }
            const instant = z.number().finite().safeParse(value);
            return [column, instant.success ? new Date(instant.data) : null];
        })
    );
}

export function serializeArchive(document: ArchiveDocument): string {
    return JSON.stringify(document);
}

const archiveValue = z.union([z.boolean(), z.number(), z.string(), z.null()]);

/**
 * A row is a flat bag of column values, so the value union is the whole check —
 * anything nested is not something this ledger ever wrote.
 */
const archiveRow = z.record(z.string(), archiveValue);

const archiveDocument = z.object({
    // A file with an unreadable timestamp is still restorable; the stamp is only
    // shown on the confirmation.
    exportedAt: z.number().catch(0),
    format: z.literal(ARCHIVE_FORMAT),
    tables: z.record(z.string(), z.array(archiveRow)),
    version: z.number().int().min(1).max(ARCHIVE_VERSION),
});

/**
 * Reads a file back, or answers null when it is not an archive this build can
 * restore.
 *
 * Deliberately strict, and deliberately silent about why: a restore replaces the
 * whole ledger, so the failure to avoid is a half-recognised file that overwrites
 * a good ledger with a partial one. A future version number is refused rather
 * than best-guessed, because the columns it adds are exactly the ones this build
 * would drop.
 */
export function parseArchive(text: string): ArchiveDocument | null {
    let parsed: z.ZodSafeParseResult<z.infer<typeof archiveDocument>>;
    try {
        parsed = archiveDocument.safeParse(JSON.parse(text));
    } catch {
        return null;
    }
    if (!parsed.success) {
        return null;
    }
    // A missing table reads as empty rather than as a malformed file: an archive
    // written before a table existed is still restorable, and the alternative is
    // refusing a file whose data is entirely intact.
    const { tables } = parsed.data;
    return {
        exportedAt: parsed.data.exportedAt,
        format: ARCHIVE_FORMAT,
        tables: {
            accounts: tables.accounts ?? [],
            appMeta: tables.appMeta ?? [],
            budgets: tables.budgets ?? [],
            categories: tables.categories ?? [],
            mainBudget: tables.mainBudget ?? [],
            transactions: tables.transactions ?? [],
            transfers: tables.transfers ?? [],
        },
        version: parsed.data.version,
    };
}

/** How many rows a file would restore, for the confirmation that precedes it. */
export function archiveRowCount(document: ArchiveDocument): number {
    return ARCHIVE_TABLES.reduce((total, table) => total + document.tables[table].length, 0);
}
