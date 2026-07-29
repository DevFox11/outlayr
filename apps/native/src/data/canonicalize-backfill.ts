import { utcDateString } from "@outlayr/money";
import { and, count, eq, isNotNull, isNull, min } from "drizzle-orm";
import { getMeta, META_KEYS } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { budgets, exchangeRates, mainBudget, transactions } from "@/db/schema";
import { canonicalUsd } from "@/domain/canonical-usd";
import { DEFAULT_CURRENCY } from "@/domain/money";
import type { ValuationCoverage } from "@/domain/valuation-coverage";
import { localRateLookup } from "./rates";

/**
 * Rows per slice, not per foreground: a pass drains the whole backlog, but in
 * slices so a ten-thousand-row ledger does not value itself in one burst. Every
 * row costs a rate lookup and an UPDATE, both synchronous on this driver.
 */
export const CANONICALIZE_BATCH = 250;

/**
 * `await` on this driver only reaches the microtask queue, which runs to
 * exhaustion before the UI gets a frame — a timer is what actually yields.
 */
function yieldToUi(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/**
 * The ledger's currency when the user actually stated it, and null otherwise.
 * `bootstrap` seeds the default unconditionally, so a stored default proves
 * nothing on its own; any other code can only have come from the picker, which
 * answers even for ledgers predating the marker.
 */
async function statedCurrency(db: SpendDb): Promise<string | null> {
	const stored = await getMeta(db, META_KEYS.currency);
	if (stored === null) {
		return null;
	}
	if (stored !== DEFAULT_CURRENCY) {
		return stored;
	}
	const chosen = await getMeta(db, META_KEYS.currencyChosen);
	return chosen === "true" ? stored : null;
}

/**
 * Names the ledger's currency on rows that never stated one, and answers how
 * many it stamped. A null currency means "whatever the setting says", so
 * switching the setting restates every unstamped row's magnitude.
 *
 * Stamps only where the user actually stated a currency: the stamp is
 * irreversible where the ambiguity it replaces is not, and a stamped USD row
 * goes on to freeze at rate 1 without any rate ever being consulted.
 *
 * Idempotent, and a no-op once the backlog is gone.
 */
export async function stampLedgerCurrency(db: SpendDb): Promise<number> {
	const display = await statedCurrency(db);
	if (display === null) {
		return 0;
	}
	let stamped = 0;

	// Budgets carry the same contract as entries: a target stored as a bare
	// number would follow the setting rather than survive it.
	for (const table of [transactions, budgets, mainBudget] as const) {
		const pending = await db
			.select({ id: table.id })
			.from(table)
			.where(isNull(table.currency));
		if (pending.length === 0) {
			continue;
		}
		await db
			.update(table)
			.set({ currency: display })
			.where(isNull(table.currency));
		stamped += pending.length;
	}

	return stamped;
}

/**
 * Fills in `amountUsd` for rows that never got one. Runs after a rate pull,
 * which is exactly when a previously unresolvable row becomes resolvable: rows
 * are skipped, never failed, so the backlog drains as coverage improves.
 *
 * A row naming no currency is not eligible — freezing it against the display
 * setting would claim a currency it never stated. Those are excluded in SQL
 * rather than skipped in the loop so they cannot fill the batch and starve rows
 * that are valuable.
 *
 * Idempotent by construction: it only ever selects `amountUsd IS NULL`.
 */
/**
 * The rows a pass can act on. Shared so a coverage readout counts the same set
 * the drain works through: a row naming no currency is not a backlog item, and
 * counting it as one reports a backlog that never drains.
 */
function uncanonicalized() {
	return and(
		isNull(transactions.amountUsd),
		isNotNull(transactions.currency),
		isNull(transactions.deletedAt),
	);
}

export async function backfillCanonicalUsd(db: SpendDb): Promise<number> {
	const lookup = localRateLookup(db);
	let valued = 0;
	// A row this pass cannot value keeps its place in the predicate, so the cursor
	// steps over it. Without that, the next slice re-reads the same rows forever.
	let cursor = 0;

	for (;;) {
		const pending = await db
			.select({
				id: transactions.id,
				amount: transactions.amount,
				currency: transactions.currency,
				date: transactions.date,
			})
			.from(transactions)
			.where(uncanonicalized())
			.orderBy(transactions.id)
			.limit(CANONICALIZE_BATCH)
			.offset(cursor);

		if (pending.length === 0) {
			return valued;
		}

		let landed = 0;
		for (const row of pending) {
			const canonical = await canonicalUsd(lookup, {
				amount: row.amount,
				currency: row.currency,
				displayCurrency: row.currency ?? DEFAULT_CURRENCY,
				date: row.date,
			});
			if (canonical.amountUsd === null) {
				// Still no rate for that day; left alone so the next pass retries it.
				continue;
			}
			await db
				.update(transactions)
				.set(canonical)
				.where(eq(transactions.id, row.id));
			landed += 1;
		}

		valued += landed;
		cursor += pending.length - landed;

		if (pending.length < CANONICALIZE_BATCH) {
			return valued;
		}
		await yieldToUi();
	}
}

/**
 * The budget twin of {@link backfillCanonicalUsd}. Values each target at the day
 * it was created, not today, or a target would drift with the market.
 */
export async function backfillBudgetUsd(db: SpendDb): Promise<number> {
	const lookup = localRateLookup(db);
	let valued = 0;

	for (const table of [budgets, mainBudget] as const) {
		const pending = await db
			.select({
				id: table.id,
				amount: table.amount,
				currency: table.currency,
				dateCreated: table.dateCreated,
				startDate: table.startDate,
			})
			.from(table)
			.where(and(isNull(table.amountUsd), isNull(table.deletedAt)));

		for (const row of pending) {
			if (row.currency === null) {
				// Not stamped yet; `stampLedgerCurrency` runs first and the next pass
				// will find it.
				continue;
			}
			const { amountUsd } = await canonicalUsd(lookup, {
				amount: row.amount,
				currency: row.currency,
				displayCurrency: row.currency,
				date: row.dateCreated ?? row.startDate ?? new Date(),
			});
			if (amountUsd === null) {
				continue;
			}
			await db.update(table).set({ amountUsd }).where(eq(table.id, row.id));
			valued += 1;
		}
	}

	return valued;
}

export async function hasUncanonicalized(db: SpendDb): Promise<boolean> {
	const rows = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(uncanonicalized())
		.limit(1);
	return rows.length > 0;
}

export async function canonicalizedCount(db: SpendDb): Promise<number> {
	const rows = await db
		.select({ total: count() })
		.from(transactions)
		.where(
			and(isNotNull(transactions.amountUsd), isNull(transactions.deletedAt)),
		);
	return rows[0]?.total ?? 0;
}

/**
 * Splits the backlog into what a later pull can still value and what it never
 * will. `pullRatesIfDue` wipe-replaces the table with a bounded window, so a row
 * dated before the earliest rate its currency holds is not waiting on anything.
 *
 * A currency with no rows at all is left in `pending`: rates for it may still
 * arrive, and "never" is not something to claim without evidence.
 */
export async function valuationCoverage(
	db: SpendDb,
): Promise<ValuationCoverage> {
	const converted = await canonicalizedCount(db);
	if (!(await hasUncanonicalized(db))) {
		return { converted, pending: 0, beyondRateHistory: 0 };
	}

	const floors = new Map<string, string>();
	const earliest = await db
		.select({ quote: exchangeRates.quote, date: min(exchangeRates.date) })
		.from(exchangeRates)
		.groupBy(exchangeRates.quote);
	for (const row of earliest) {
		if (row.date !== null) {
			floors.set(row.quote, row.date);
		}
	}

	const pending = await db
		.select({ currency: transactions.currency, date: transactions.date })
		.from(transactions)
		.where(uncanonicalized());

	let beyondRateHistory = 0;
	for (const row of pending) {
		// A USD row freezes at rate 1 without any rate being consulted.
		const floor =
			row.currency === null || row.currency === "USD"
				? undefined
				: floors.get(row.currency);
		if (floor !== undefined && utcDateString(row.date.getTime()) < floor) {
			beyondRateHistory += 1;
		}
	}

	return {
		converted,
		pending: pending.length - beyondRateHistory,
		beyondRateHistory,
	};
}
