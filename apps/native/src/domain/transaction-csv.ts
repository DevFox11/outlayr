import { formatCsvRow } from "./csv";
import { minorUnitsFor } from "./money";

/**
 * The wire format. `Date` is an ISO 8601 instant rather than the Swift export's
 * `Date` description (`CSVExport.swift:31`) so the moment survives the round
 * trip in any zone, and `Currency` exists at all because a row now carries one —
 * dropping it would restate a €12.50 lunch as $12.50 on the way back in.
 */
export const CSV_HEADER = [
    "Date",
    "Note",
    "Amount",
    "Currency",
    "Category",
    "Type",
    "Exchange Rate Type",
    "Exchange Rate",
] as const;

const CSV_TYPE_INCOME = "Income";
const CSV_TYPE_EXPENSE = "Expense";

export interface ExportableTransaction {
    amount: number;
    categoryName: string | null;
    /** Null means the row stated none and takes the ledger's code. */
    currency: string | null;
    date: Date;
    exchangeRate: number | null;
    exchangeRateType: string | null;
    income: boolean;
    note: string;
}

export type DecimalSeparator = "." | ",";

/** Enough decimals for any money figure without reaching exponential notation. */
const MAX_DECIMALS = 10;

const TRAILING_ZEROS = /0+$/;
const TRAILING_DOT = /\.$/;
const PARENTHESISED = /^\(.*\)$/;
const PLAIN_DECIMAL = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;

function exactDecimal(value: number): string {
    const plain = value.toFixed(MAX_DECIMALS).replace(TRAILING_ZEROS, "").replace(TRAILING_DOT, "");
    return Number.parseFloat(plain) === value ? plain : String(value);
}

/**
 * Unsigned, ungrouped, `.`-separated — the figure a machine reads back to the
 * same number. `amount` is a float in major units, so a value carrying more
 * precision than the currency's minor units keeps it rather than being rounded
 * on the way out.
 */
export function serializeCsvAmount(amount: number, currency: string): string {
    const magnitude = Math.abs(amount);
    const fixed = magnitude.toFixed(minorUnitsFor(currency));
    return Number.parseFloat(fixed) === magnitude ? fixed : exactDecimal(magnitude);
}

function soleSeparator(lastDot: number, lastComma: number): DecimalSeparator | null {
    if (lastDot !== -1) {
        return ".";
    }
    if (lastComma !== -1) {
        return ",";
    }
    return null;
}

export function detectDecimalSeparator(values: readonly string[]): DecimalSeparator {
    let comma = 0;
    let dot = 0;

    for (const raw of values) {
        const value = raw.trim();
        const lastDot = value.lastIndexOf(".");
        const lastComma = value.lastIndexOf(",");

        if (lastDot !== -1 && lastComma !== -1) {
            if (lastDot > lastComma) {
                dot += 1;
            } else {
                comma += 1;
            }
            continue;
        }

        const separator = soleSeparator(lastDot, lastComma);
        if (separator == null) {
            continue;
        }
        const index = Math.max(lastDot, lastComma);
        const occurrences = value.split(separator).length - 1;
        const tail = value.length - index - 1;
        if (occurrences > 1 || tail === 3) {
            continue;
        }
        if (separator === ".") {
            dot += 1;
        } else {
            comma += 1;
        }
    }

    return comma > dot ? "," : ".";
}

/**
 * Answers null rather than a guess, so the import preview can show the row as
 * unreadable instead of writing a number nobody typed.
 */
export function parseCsvAmount(text: string, separator: DecimalSeparator = "."): number | null {
    const trimmed = text.trim();
    if (trimmed === "") {
        return null;
    }

    const parenthesised = PARENTHESISED.test(trimmed);
    const grouping = separator === "." ? "," : ".";
    let cleaned = trimmed.replaceAll(grouping, "");
    if (separator === ",") {
        cleaned = cleaned.replaceAll(",", ".");
    }
    // Currency symbols, spaces and non-breaking spaces are noise; the sign is not.
    cleaned = cleaned.replaceAll(/[^\d.\-+]/g, "");

    if (!PLAIN_DECIMAL.test(cleaned)) {
        return null;
    }
    const value = Number.parseFloat(cleaned);
    if (!Number.isFinite(value)) {
        return null;
    }
    return parenthesised ? -Math.abs(value) : value;
}

export function formatCsvDate(date: Date): string {
    return date.toISOString();
}

/** `ISO` means "parse as an ISO 8601 instant", which keeps the exact moment. */
const DATE_FORMATS = [
    "ISO",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd",
    "dd/MM/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm:ss",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "yyyy/MM/dd",
    "dd-MM-yyyy",
    "MM-dd-yyyy",
    "dd.MM.yyyy",
    "yyyyMMdd",
    "ddMMyyyy",
    "MMddyyyy",
] as const;

const TOKENS = ["yyyy", "MM", "dd", "HH", "mm", "ss"] as const;
type Token = (typeof TOKENS)[number];

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

interface FormatPattern {
    order: Token[];
    regex: RegExp;
}

const PATTERN_CACHE = new Map<string, FormatPattern | null>();

function compile(format: string): FormatPattern | null {
    const order: Token[] = [];
    let source = "^";
    let i = 0;

    while (i < format.length) {
        const cursor = i;
        const token = TOKENS.find((candidate) => format.startsWith(candidate, cursor));
        if (token == null) {
            source += format[i]?.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "";
            i += 1;
            continue;
        }
        order.push(token);
        i += token.length;
        if (token === "yyyy") {
            source += "(\\d{4})";
            continue;
        }
        // A two-digit field with no separator after it cannot be variable-width, or
        // `yyyyMMdd` would read "0729" as month 7 and day 29 only by luck.
        const afterToken = i;
        const adjacent = TOKENS.some((candidate) => format.startsWith(candidate, afterToken));
        source += adjacent ? "(\\d{2})" : "(\\d{1,2})";
    }

    if (order.length === 0) {
        return null;
    }
    return { order, regex: new RegExp(`${source}$`) };
}

function patternFor(format: string): FormatPattern | null {
    if (!PATTERN_CACHE.has(format)) {
        PATTERN_CACHE.set(format, compile(format));
    }
    return PATTERN_CACHE.get(format) ?? null;
}

/**
 * Date-only values land on local midnight, matching how `startOfDay` buckets a
 * row into its day. A parse whose components do not survive the calendar (31
 * February) answers null rather than rolling into the next month.
 */
export function parseCsvDate(value: string, format: string): Date | null {
    const trimmed = value.trim();
    if (trimmed === "") {
        return null;
    }

    if (format === "ISO") {
        if (!ISO_INSTANT.test(trimmed)) {
            return null;
        }
        const parsed = new Date(trimmed.replace(" ", "T"));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const pattern = patternFor(format);
    if (pattern == null) {
        return null;
    }
    const match = pattern.regex.exec(trimmed);
    if (match == null) {
        return null;
    }

    const parts = {
        HH: 0,
        MM: 1,
        dd: 1,
        mm: 0,
        ss: 0,
        yyyy: 1970,
    } satisfies Record<Token, number>;
    for (const [index, token] of pattern.order.entries()) {
        parts[token] = Number.parseInt(match[index + 1] ?? "", 10);
    }

    const date = new Date(parts.yyyy, parts.MM - 1, parts.dd, parts.HH, parts.mm, parts.ss, 0);
    if (date.getFullYear() !== parts.yyyy || date.getMonth() !== parts.MM - 1 || date.getDate() !== parts.dd) {
        return null;
    }
    return date;
}

/**
 * The format the whole column agrees on. Ambiguity between `dd/MM` and `MM/dd`
 * is settled by looking for a component above twelve somewhere in the column —
 * taking the first pattern that happens to match one value is how a US export
 * silently becomes a day-first ledger.
 */
export function deduceDateFormat(values: readonly string[]): string | null {
    const sample = values.map((value) => value.trim()).filter((v) => v !== "");
    if (sample.length === 0) {
        return null;
    }

    // A format is judged by how many values it parses, not by parsing them
    // all: one stray malformed row must not turn every other date unreadable.
    const parseCount = new Map(
        DATE_FORMATS.map((format) => [format, sample.filter((value) => parseCsvDate(value, format) != null).length])
    );
    const best = Math.max(...parseCount.values());
    if (best === 0 || best * 2 < sample.length) {
        return null;
    }
    const viable = DATE_FORMATS.filter((format) => parseCount.get(format) === best);

    const dayFirst = viable.find((format) => format.startsWith("dd"));
    const monthFirst = viable.find((format) => format.startsWith("MM"));
    if (dayFirst != null && monthFirst != null) {
        const leadsAboveTwelve = sample.some(
            (value) =>
                (parseCsvDate(value, dayFirst) != null || parseCsvDate(value, monthFirst) != null) &&
                Number.parseInt(value.slice(0, 2), 10) > 12
        );
        return leadsAboveTwelve ? dayFirst : monthFirst;
    }

    return viable[0] ?? null;
}

const INCOME_WORDS = new Set(["income", "credit", "cr", "in", "deposit"]);
const EXPENSE_WORDS = new Set(["expense", "debit", "dr", "out", "withdrawal"]);

/** Null means the field says nothing about direction. */
export function parseCsvType(value: string): boolean | null {
    const word = value.trim().toLowerCase();
    if (INCOME_WORDS.has(word)) {
        return true;
    }
    if (EXPENSE_WORDS.has(word)) {
        return false;
    }
    return null;
}

export function transactionsToCsv(rows: readonly ExportableTransaction[], ledgerCurrency: string): string {
    const lines = [formatCsvRow(CSV_HEADER)];
    for (const row of rows) {
        const currency = row.currency ?? ledgerCurrency;
        const hasRateMetadata = currency !== "USD";
        lines.push(
            formatCsvRow([
                formatCsvDate(row.date),
                row.note,
                serializeCsvAmount(row.amount, currency),
                currency,
                row.categoryName ?? "",
                row.income ? CSV_TYPE_INCOME : CSV_TYPE_EXPENSE,
                hasRateMetadata ? (row.exchangeRateType ?? "") : "",
                hasRateMetadata && row.exchangeRate != null ? exactDecimal(row.exchangeRate) : "",
            ])
        );
    }
    return `${lines.join("\n")}\n`;
}
