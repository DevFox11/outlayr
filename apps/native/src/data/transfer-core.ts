import { desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { parseCsv } from "@/domain/csv";
import { DEFAULT_CURRENCY } from "@/domain/money";
import {
	type DecimalSeparator,
	parseCsvAmount,
	parseCsvDate,
	parseCsvType,
	transactionsToCsv,
} from "@/domain/transaction-csv";
import { getMeta, META_KEYS } from "./app-meta-core";
import { transactionsRepo } from "./transactions-core";

export async function exportTransactionsCsv(db: Database): Promise<string> {
	const rows = await db
		.select({
			amount: transactions.amount,
			categoryName: categories.name,
			currency: transactions.currency,
			date: transactions.date,
			income: transactions.income,
			note: transactions.note,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.categoryId, categories.id))
		.where(isNull(transactions.deletedAt))
		.orderBy(desc(transactions.date));

	const ledgerCurrency = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
	return transactionsToCsv(rows, ledgerCurrency);
}

export function exportFileName(now: Date): string {
	const year = now.getFullYear();
	const month = `${now.getMonth() + 1}`.padStart(2, "0");
	const day = `${now.getDate()}`.padStart(2, "0");
	return `outlayr-${year}-${month}-${day}.csv`;
}

/** Which CSV column feeds each field. `null` means the file carries none. */
export interface ColumnMapping {
	amount: number;
	category: number;
	currency: number | null;
	date: number;
	/** Optional: an unmapped note falls back to the category's name on write. */
	note: number | null;
	type: number | null;
}

const HEADER_HINTS: Record<keyof ColumnMapping, readonly string[]> = {
	amount: ["amount", "value", "total", "sum", "debit"],
	category: ["category", "categories", "tag"],
	currency: ["currency", "code", "ccy"],
	date: ["date", "time", "posted", "when"],
	note: ["note", "description", "memo", "payee", "merchant", "name", "details"],
	type: ["type", "direction", "kind"],
};

/**
 * Best guess from a header row, so a file this app exported maps itself. Fields
 * it cannot place are left `null` for the user to assign, which is why `date`
 * and `amount` widen here but not in {@link ColumnMapping}.
 */
export function guessMapping(header: readonly string[]): Record<keyof ColumnMapping, number | null> {
	const normalized = header.map((cell) => cell.trim().toLowerCase());
	const taken = new Set<number>();
	const guess: Record<keyof ColumnMapping, number | null> = {
		amount: null,
		category: null,
		currency: null,
		date: null,
		note: null,
		type: null,
	};

	for (const field of Object.keys(HEADER_HINTS) as (keyof ColumnMapping)[]) {
		const index = normalized.findIndex(
			(cell, at) => !taken.has(at) && HEADER_HINTS[field].some((hint) => cell.includes(hint))
		);
		if (index >= 0) {
			guess[field] = index;
			taken.add(index);
		}
	}
	return guess;
}

export interface ImportEntry {
	amount: number;
	categoryId: string;
	/** Null adopts the ledger's code at write time. */
	currency: string | null;
	date: Date;
	imageColor?: string | null;
	/** Attached at commit time from the merchant's cached logo, if any. */
	imageUri?: string | null;
	income: boolean;
	note: string;
}

export type SkipReason = "category" | "date" | "amount";

export interface SkippedRow {
	reason: SkipReason;
	/** 1-based over the data rows, so it names what the user sees in the file. */
	row: number;
}

export interface ImportPlan {
	earliest: Date | null;
	entries: ImportEntry[];
	latest: Date | null;
	skipped: SkippedRow[];
}

/**
 * The key a CSV category value is linked under. Folded, unlike Swift's exact
 * `unique()` (`Sequence+Unique.swift`), which asked the user to link `"Food"`
 * and `"food "` separately and then failed the import when they missed one.
 */
export function categoryKey(value: string): string {
	return value.trim().toLowerCase();
}

export interface ParsedImportFile {
	/** Null when the first line already carries data. */
	header: string[] | null;
	rows: string[][];
	/** Widest row, since a CSV may be ragged. */
	width: number;
}

/** A date, an amount and a category are the least this can build a row from. */
const MINIMUM_COLUMNS = 3;

const ANY_DIGIT = /\d/;

/**
 * The header test is Swift's (`ImportDataView+Logic.swift:126`): a first line
 * with no digit in it is a header, because a data row always carries at least a
 * date or an amount.
 */
export function splitHeaderAndRows(lines: string[][]): {
	header: string[] | null;
	rows: string[][];
} {
	const first = lines[0] ?? [];
	const looksLikeHeader = !ANY_DIGIT.test(first.join(""));
	const rows = looksLikeHeader ? lines.slice(1) : lines;
	return { header: looksLikeHeader ? first : null, rows };
}

/**
 * Null means the file cannot be used at all, which the caller reports once
 * rather than letting the user assign columns to something unusable.
 */
export function parseImportFile(text: string): ParsedImportFile | null {
	const lines = parseCsv(text);
	if (lines.length === 0) {
		return null;
	}

	const { header, rows } = splitHeaderAndRows(lines);
	if (rows.length === 0) {
		return null;
	}

	const width = Math.max(...rows.map((row) => row.length));
	if (width < MINIMUM_COLUMNS) {
		return null;
	}

	return { header, rows, width };
}

/** First-appearance spelling of every distinct value in the category column. */
export function uniqueCategoryValues(rows: readonly (readonly string[])[], index: number): string[] {
	const seen = new Set<string>();
	const values: string[] = [];
	for (const row of rows) {
		const raw = row[index]?.trim();
		if (raw == null || raw === "") {
			continue;
		}
		const key = categoryKey(raw);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		values.push(raw);
	}
	return values;
}

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function readImportRow(
	row: readonly string[],
	mapping: ColumnMapping,
	dateFormat: string,
	decimal: DecimalSeparator,
	links: ReadonlyMap<string, string>,
	categoryIncome: ReadonlyMap<string, boolean>
): ImportEntry | SkipReason {
	const categoryId = links.get(categoryKey(row[mapping.category] ?? ""));
	if (categoryId == null) {
		return "category";
	}

	const date = parseCsvDate(row[mapping.date] ?? "", dateFormat);
	if (date == null) {
		return "date";
	}

	const amount = parseCsvAmount(row[mapping.amount] ?? "", decimal);
	if (amount == null) {
		return "amount";
	}

	const declaredType = mapping.type == null ? null : parseCsvType(row[mapping.type] ?? "");
	const currencyCell = mapping.currency == null ? "" : (row[mapping.currency] ?? "").trim();

	return {
		amount: Math.abs(amount),
		categoryId,
		currency: CURRENCY_CODE.test(currencyCell) ? currencyCell.toUpperCase() : null,
		date,
		income: declaredType ?? categoryIncome.get(categoryId) ?? false,
		note: mapping.note == null ? "" : (row[mapping.note] ?? "").trim(),
	};
}

/**
 * Parses the whole file up front so the user can see what will land — and what
 * will not — before anything is written. A row that cannot be read is dropped
 * with its reason rather than defaulted, because a guessed date or a guessed
 * category is indistinguishable from a real one once it is in the ledger.
 */
export function buildImportPlan(
	rows: readonly (readonly string[])[],
	mapping: ColumnMapping,
	dateFormat: string,
	decimal: DecimalSeparator,
	links: ReadonlyMap<string, string>,
	categoryIncome: ReadonlyMap<string, boolean>
): ImportPlan {
	const entries: ImportEntry[] = [];
	const skipped: SkippedRow[] = [];
	let earliest: Date | null = null;
	let latest: Date | null = null;

	for (const [index, row] of rows.entries()) {
		const read = readImportRow(row, mapping, dateFormat, decimal, links, categoryIncome);
		if (typeof read === "string") {
			skipped.push({ reason: read, row: index + 1 });
			continue;
		}

		entries.push(read);

		if (earliest == null || read.date < earliest) {
			earliest = read.date;
		}
		if (latest == null || read.date > latest) {
			latest = read.date;
		}
	}

	return { earliest, entries, latest, skipped };
}

/**
 * All or nothing. A half-applied import is the worst outcome the feature has:
 * the user cannot tell which rows landed, and re-running it duplicates whatever
 * did.
 */
export async function applyImport(db: Database, plan: ImportPlan): Promise<number> {
	if (plan.entries.length === 0) {
		return 0;
	}

	await withTransaction(db, async () => {
		for (const entry of plan.entries) {
			// biome-ignore lint/performance/noAwaitInLoops: each create reads before it inserts, and every statement shares the one connection withTransaction holds open — issuing them together interleaves those reads and writes across the transaction that makes this import all-or-nothing
			await transactionsRepo.create(db, {
				amount: entry.amount,
				categoryId: entry.categoryId,
				currency: entry.currency,
				date: entry.date,
				details: null,
				imageColor: entry.imageColor ?? null,
				imageUri: entry.imageUri ?? null,
				income: entry.income,
				note: entry.note,
			});
		}
	});

	return plan.entries.length;
}
