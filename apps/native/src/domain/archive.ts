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
export const ARCHIVE_DATE_COLUMNS: Record<ArchiveTable, readonly string[]> = {
    accounts: ["initialBalanceDate", "dateCreated", "updatedAt", "deletedAt"],
    appMeta: [],
    budgets: ["startDate", "dateCreated", "updatedAt", "deletedAt"],
    categories: ["dateCreated", "updatedAt", "deletedAt"],
    mainBudget: ["startDate", "dateCreated", "updatedAt", "deletedAt"],
    transactions: ["date", "day", "month", "recurringEndDate", "updatedAt", "deletedAt"],
    transfers: ["date", "day", "month", "dateCreated", "updatedAt", "deletedAt"],
};

export type ArchiveRow = Record<string, unknown>;

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
export function encodeArchiveRow(table: ArchiveTable, row: ArchiveRow): ArchiveRow {
    const dateColumns = ARCHIVE_DATE_COLUMNS[table];
    const encoded: ArchiveRow = {};
    for (const [column, value] of Object.entries(row)) {
        encoded[column] = dateColumns.includes(column) && value instanceof Date ? value.getTime() : value;
    }
    return encoded;
}

/**
 * The inverse. A date column holding something that is not a finite number
 * decodes to null rather than to `new Date(NaN)`, which would restore a row
 * whose date throws the moment anything formats it.
 */
export function decodeArchiveRow(table: ArchiveTable, row: ArchiveRow): ArchiveRow {
    const dateColumns = ARCHIVE_DATE_COLUMNS[table];
    const decoded: ArchiveRow = {};
    for (const [column, value] of Object.entries(row)) {
        if (!dateColumns.includes(column)) {
            decoded[column] = value;
            continue;
        }
        decoded[column] = typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
    }
    return decoded;
}

export function serializeArchive(document: ArchiveDocument): string {
    return JSON.stringify(document);
}

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
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null) {
        return null;
    }
    const candidate = parsed as Partial<ArchiveDocument>;
    if (candidate.format !== ARCHIVE_FORMAT) {
        return null;
    }
    if (typeof candidate.version !== "number" || candidate.version < 1 || candidate.version > ARCHIVE_VERSION) {
        return null;
    }
    const { tables } = candidate;
    if (typeof tables !== "object" || tables === null) {
        return null;
    }
    const collected = {} as Record<ArchiveTable, ArchiveRow[]>;
    for (const table of ARCHIVE_TABLES) {
        const rows = (tables as Record<string, unknown>)[table];
        // A missing table reads as empty rather than as a malformed file: an
        // archive written before a table existed is still restorable, and the
        // alternative is refusing a file whose data is entirely intact.
        if (rows === undefined) {
            collected[table] = [];
            continue;
        }
        if (!Array.isArray(rows) || rows.some((row) => !isPlainRow(row))) {
            return null;
        }
        collected[table] = rows as ArchiveRow[];
    }
    return {
        exportedAt: typeof candidate.exportedAt === "number" ? candidate.exportedAt : 0,
        format: ARCHIVE_FORMAT,
        tables: collected,
        version: candidate.version,
    };
}

function isPlainRow(value: unknown): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** How many rows a file would restore, for the confirmation that precedes it. */
export function archiveRowCount(document: ArchiveDocument): number {
    return ARCHIVE_TABLES.reduce((total, table) => total + document.tables[table].length, 0);
}
