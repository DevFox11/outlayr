import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getMeta, META_KEYS } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { budgets, mainBudget, transactions } from "@/db/schema";
import { canonicalUsd } from "@/domain/canonical-usd";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { localRateLookup } from "./rates";

/** Every row costs a rate lookup; what a pass misses the next one picks up. */
const BATCH = 250;

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
export async function backfillCanonicalUsd(db: SpendDb): Promise<number> {
	const pending = await db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			currency: transactions.currency,
			date: transactions.date,
		})
		.from(transactions)
		.where(
			and(
				isNull(transactions.amountUsd),
				isNotNull(transactions.currency),
				isNull(transactions.deletedAt),
			),
		)
		.limit(BATCH);

	if (pending.length === 0) {
		return 0;
	}

	const lookup = localRateLookup(db);
	let valued = 0;

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
		valued += 1;
	}

	return valued;
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
		.where(and(isNull(transactions.amountUsd), isNull(transactions.deletedAt)))
		.limit(1);
	return rows.length > 0;
}

export async function canonicalizedCount(db: SpendDb): Promise<number> {
	const rows = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(
			and(isNotNull(transactions.amountUsd), isNull(transactions.deletedAt)),
		);
	return rows.length;
}
