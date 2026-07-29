import { and, asc, desc, isNull, lte } from "drizzle-orm";
import Spotlight from "expo-core-spotlight";
import { Platform } from "react-native";
import { getMeta, META_KEYS } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { parseBoolSetting } from "@/data/settings-core";
import {
	budgets as budgetsTable,
	categories as categoriesTable,
	transactions as transactionsTable,
} from "@/db/schema";
import { formatDayHeader } from "@/domain/dates";
import { DEFAULT_CURRENCY, formatAmount } from "@/domain/money";
import { budgetLink, transactionLink } from "./deep-links";

/**
 * Domains let the index be replaced wholesale per kind: a publish clears the
 * domain and re-indexes it, so deletions need no reconciliation.
 */
const TRANSACTION_DOMAIN = "transactions";
const BUDGET_DOMAIN = "budgets";

/**
 * How many entries are searchable. Spotlight itself would take far more, but
 * every publish rewrites the whole domain, so the cap bounds that cost rather
 * than Spotlight's.
 */
const TRANSACTION_LIMIT = 500;

/**
 * Each item's `uniqueIdentifier` IS its `outlayr://` link. `expo-core-spotlight`
 * opens that identifier as a URL when a result is tapped, which routes the tap
 * through `+native-intent` alongside the widgets, Siri and the quick actions.
 *
 * Failures are swallowed: an un-indexed ledger is a search that comes up empty,
 * while a throw here would take down the write that triggered it.
 */
export async function indexSpotlight(db: SpendDb, now = new Date()) {
	if (Platform.OS !== "ios") {
		return;
	}
	try {
		if (!(await Spotlight.isAvailable())) {
			return;
		}

		const currencyRaw = await getMeta(db, META_KEYS.currency);
		const showCents = parseBoolSetting(await getMeta(db, "showCents"), true);
		const currency = currencyRaw ?? DEFAULT_CURRENCY;
		const money = (value: number) => formatAmount(value, currency, showCents);

		const categoryRows = await db
			.select({
				id: categoriesTable.id,
				name: categoriesTable.name,
			})
			.from(categoriesTable)
			.where(isNull(categoriesTable.deletedAt));
		const categoryName = new Map(categoryRows.map((row) => [row.id, row.name]));

		await Promise.all([
			indexTransactions(db, now, money, categoryName),
			indexBudgets(db, money, categoryName),
		]);
	} catch (error) {
		console.warn("[outlayr] spotlight index failed", error);
	}
}

type Money = (value: number) => string;

async function indexTransactions(
	db: SpendDb,
	now: Date,
	money: Money,
	categoryName: ReadonlyMap<string, string | null>,
) {
	const rows = await db
		.select({
			id: transactionsTable.id,
			note: transactionsTable.note,
			details: transactionsTable.details,
			amount: transactionsTable.amount,
			income: transactionsTable.income,
			categoryId: transactionsTable.categoryId,
			date: transactionsTable.date,
		})
		.from(transactionsTable)
		.where(
			and(
				isNull(transactionsTable.deletedAt),
				lte(transactionsTable.date, now),
			),
		)
		.orderBy(desc(transactionsTable.date))
		.limit(TRANSACTION_LIMIT);

	await Spotlight.removeAllItemsFromDomain(TRANSACTION_DOMAIN);
	if (rows.length === 0) {
		return;
	}

	await Spotlight.indexItems(
		rows.map((row) => {
			const category = row.categoryId
				? (categoryName.get(row.categoryId) ?? null)
				: null;
			const amount = money(row.amount);
			return {
				uniqueIdentifier: transactionLink(row.id),
				domainIdentifier: TRANSACTION_DOMAIN,
				// `note` is non-null but can be empty, and a blank Spotlight title
				// renders as an untappable-looking empty row. The write path already
				// falls back to the category name; this covers rows that predate it.
				title: row.note.trim() || category || "Entry",
				// What the row says on the Log, in the order the Log says it.
				contentDescription: [
					row.income ? `+${amount}` : amount,
					category,
					formatDayHeader(row.date, now),
				]
					.filter(Boolean)
					.join(" · "),
				// The amount is included unformatted so "12.40" finds the coffee.
				keywords: [
					row.note,
					category,
					row.details,
					String(row.amount),
					row.income ? "income" : "expense",
				].filter((value): value is string => Boolean(value)),
				lastUsedDate: row.date.getTime(),
			};
		}),
	);
}

async function indexBudgets(
	db: SpendDb,
	money: Money,
	categoryName: ReadonlyMap<string, string | null>,
) {
	const rows = await db
		.select({
			id: budgetsTable.id,
			name: budgetsTable.name,
			amount: budgetsTable.amount,
			categoryId: budgetsTable.categoryId,
		})
		.from(budgetsTable)
		.where(isNull(budgetsTable.deletedAt))
		.orderBy(asc(budgetsTable.dateCreated));

	await Spotlight.removeAllItemsFromDomain(BUDGET_DOMAIN);
	if (rows.length === 0) {
		return;
	}

	await Spotlight.indexItems(
		rows.map((row) => {
			const name =
				(row.name?.trim() ? row.name.trim() : null) ??
				(row.categoryId ? categoryName.get(row.categoryId) : null) ??
				"Budget";
			return {
				uniqueIdentifier: budgetLink(row.id),
				domainIdentifier: BUDGET_DOMAIN,
				title: `${name} budget`,
				// Deliberately the limit, not what is left: Spotlight results are not
				// re-indexed as you spend, so a "left" figure would go stale between
				// writes and quietly misreport money.
				contentDescription: `Limit ${money(row.amount)}`,
				keywords: [name, "budget"],
			};
		}),
	);
}

/** Clears everything this app put in the index — used by Erase Data. */
export async function clearSpotlight() {
	if (Platform.OS !== "ios") {
		return;
	}
	try {
		await Spotlight.removeAllItems();
	} catch (error) {
		console.warn("[outlayr] spotlight clear failed", error);
	}
}
