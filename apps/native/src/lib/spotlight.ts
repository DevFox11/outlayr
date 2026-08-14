import { and, asc, desc, isNull, lte } from "drizzle-orm";
import Spotlight from "expo-core-spotlight";
import { Platform } from "react-native";

import { getMeta } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { parseBoolSetting } from "@/data/settings-core";
import { loadValuation } from "@/data/valuation-source";
import type { Valuation } from "@/data/valuation-source";
import { budgets as budgetsTable, categories as categoriesTable, transactions as transactionsTable } from "@/db/schema";
import { advanceBudgetWindow } from "@/domain/budget-math";
import { formatDayHeader } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { limitIn } from "@/domain/valuation";
import { CATALOGS, EN } from "@/i18n/catalog";
import type { TranslatableKey } from "@/i18n/catalog";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";
import { translateNow } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";

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

        const valuation = await loadValuation(db);
        const showCents = parseBoolSetting(await getMeta(db, "showCents"), true);
        // The code is per figure, not per index: a stored amount and the display
        // currency are two different things, and printing one under the other's
        // symbol misreports money.
        const money = (value: number, code: string) => formatAmount(value, code, showCents);

        const categoryRows = await db
            .select({
                id: categoriesTable.id,
                name: categoriesTable.name,
            })
            .from(categoriesTable)
            .where(isNull(categoriesTable.deletedAt));
        const categoryName = new Map(categoryRows.map((row) => [row.id, row.name]));

        await Promise.all([
            indexTransactions(db, now, money, valuation, categoryName),
            indexBudgets(db, now, money, valuation, categoryName),
        ]);
    } catch (error) {
        console.warn("[outlayr] spotlight index failed", error);
    }
}

type Money = (value: number, code: string) => string;

/**
 * A keyword is a term someone types, and the index is only rewritten when the
 * ledger is — so indexing the active language alone would leave every result
 * unfindable by its own search term the moment the language changes, until the
 * next write happens to republish. Keywords match one at a time, so carrying
 * every language's form costs index size and nothing else.
 */
function keywordForms(key: TranslatableKey): string[] {
    return [
        ...new Set(
            SUPPORTED_LANGUAGES.map((language) => translate(key, { catalog: CATALOGS[language], fallback: EN }))
        ),
    ];
}

async function indexTransactions(
    db: SpendDb,
    now: Date,
    money: Money,
    valuation: Valuation,
    categoryName: ReadonlyMap<string, string | null>
) {
    const rows = await db
        .select({
            amount: transactionsTable.amount,
            categoryId: transactionsTable.categoryId,
            currency: transactionsTable.currency,
            date: transactionsTable.date,
            details: transactionsTable.details,
            id: transactionsTable.id,
            income: transactionsTable.income,
            note: transactionsTable.note,
        })
        .from(transactionsTable)
        .where(and(isNull(transactionsTable.deletedAt), lte(transactionsTable.date, now)))
        .orderBy(desc(transactionsTable.date))
        .limit(TRANSACTION_LIMIT);

    await Spotlight.removeAllItemsFromDomain(TRANSACTION_DOMAIN);
    if (rows.length === 0) {
        return;
    }

    const untitled = translateNow("spotlight.entry");
    const incomeKeywords = keywordForms("common.income");
    const expenseKeywords = keywordForms("common.expense");

    await Spotlight.indexItems(
        rows.map((row) => {
            const category = row.categoryId ? (categoryName.get(row.categoryId) ?? null) : null;
            // Under its own code, never the ledger's: the Log row this result opens
            // prints the stored amount unconverted and marks the foreign code beside
            // it, so converting here would disagree with the screen it deep-links to.
            const amount = money(row.amount, row.currency ?? valuation.displayCurrency);
            return {
                // What the row says on the Log, in the order the Log says it.
                contentDescription: [row.income ? `+${amount}` : amount, category, formatDayHeader(row.date, now)]
                    .filter(Boolean)
                    .join(" · "),
                domainIdentifier: TRANSACTION_DOMAIN,
                keywords: [
                    // The amount is included unformatted so "12.40" finds the coffee.
                    ...[row.note, category, row.details, String(row.amount)].filter((value): value is string =>
                        Boolean(value)
                    ),
                    ...(row.income ? incomeKeywords : expenseKeywords),
                ],
                lastUsedDate: row.date.getTime(),
                // `note` is non-null but can be empty, and a blank Spotlight title
                // renders as an untappable-looking empty row. The write path already
                // falls back to the category name; this covers rows that predate it.
                title: row.note.trim() || category || untitled,
                uniqueIdentifier: transactionLink(row.id),
            };
        })
    );
}

async function indexBudgets(
    db: SpendDb,
    now: Date,
    money: Money,
    valuation: Valuation,
    categoryName: ReadonlyMap<string, string | null>
) {
    const rows = await db
        .select({
            amount: budgetsTable.amount,
            amountUsd: budgetsTable.amountUsd,
            categoryId: budgetsTable.categoryId,
            currency: budgetsTable.currency,
            id: budgetsTable.id,
            name: budgetsTable.name,
            startDate: budgetsTable.startDate,
            type: budgetsTable.type,
        })
        .from(budgetsTable)
        .where(isNull(budgetsTable.deletedAt))
        .orderBy(asc(budgetsTable.dateCreated));

    await Spotlight.removeAllItemsFromDomain(BUDGET_DOMAIN);
    if (rows.length === 0) {
        return;
    }

    // Its own label, not the overall budget's: every row here is one category's
    // cap, and a pull can leave one whose category is tombstoned with nothing to
    // name it. Composing the title around it would read "Budget budget".
    const unnamed = translateNow("spotlight.budget.fallback");
    const budgetKeywords = keywordForms("spotlight.budget.keyword");

    await Spotlight.indexItems(
        rows.map((row) => {
            const name =
                (row.name?.trim() ? row.name.trim() : null) ??
                (row.categoryId ? categoryName.get(row.categoryId) : null) ??
                null;
            // The window's own day, exactly as the Budgets screen values it — a
            // target set in one currency is not the same number under another.
            const window = advanceBudgetWindow(row.startDate ?? now, row.type, now);
            return {
                // Deliberately the limit, not what is left: Spotlight results are not
                // re-indexed as you spend, so a "left" figure would go stale between
                // writes and quietly misreport money.
                contentDescription: translateNow("spotlight.budget.limit", {
                    amount: money(
                        limitIn(row, window.start, valuation.displayCurrency, valuation.rates),
                        valuation.displayCurrency
                    ),
                }),
                domainIdentifier: BUDGET_DOMAIN,
                keywords: [name, ...budgetKeywords].filter((value): value is string => Boolean(value)),
                title: name ? translateNow("spotlight.budget.title", { name }) : unnamed,
                uniqueIdentifier: budgetLink(row.id),
            };
        })
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
