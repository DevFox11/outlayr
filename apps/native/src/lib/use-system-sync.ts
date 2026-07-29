import { and, desc, eq, isNull, like } from "drizzle-orm";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import {
	backfillBudgetUsd,
	backfillCanonicalUsd,
	stampLedgerCurrency,
} from "@/data/canonicalize-backfill";
import { pullRatesIfDue } from "@/data/rates";
import { transactionsRepo } from "@/data/transactions";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { detectCurrency } from "@/domain/detect-currency";
import { ratesPuller } from "@/lib/convex";
import { publishWidgets } from "@/widgets";
import { indexSpotlight } from "./spotlight";
import {
	affectsSpotlight,
	affectsWidgets,
	debounce,
	PUBLISH_DEBOUNCE_MS,
	SPOTLIGHT_DEBOUNCE_MS,
} from "./sync-cadence";
import { drainPendingWrites, type PendingWrite } from "./widget-bridge";

/**
 * Keeps the widget tiles and the Spotlight index current, each on its own
 * cadence — see `sync-cadence.ts` for which tables reach which surface and why
 * the index trails the tiles so far.
 *
 * `db` is nullable so this can be called before the database is open, matching
 * `useRecurrenceSweep`.
 */
export function useSystemSync(db: Database | null): void {
	useEffect(() => {
		if (db == null) {
			return;
		}

		const publish = debounce(PUBLISH_DEBOUNCE_MS, () => {
			void publishWidgets(db);
		});
		const reindex = debounce(SPOTLIGHT_DEBOUNCE_MS, () => {
			void indexSpotlight(db);
		});

		// Applying the queue writes rows, which trips the change listener below and
		// publishes on its own — so this deliberately does not publish itself.
		const catchUp = () => {
			applyPendingWrites(db)
				.then((applied) => {
					if (applied === 0) {
						publish.schedule();
					}
				})
				.catch((error) => {
					console.warn("[outlayr] pending writes failed to apply", error);
					publish.schedule();
				});
		};

		catchUp();
		void indexSpotlight(db);
		// Republished explicitly, because the listener below does not cover it: a
		// refresh opens with an unqualified `DELETE FROM exchangeRates`, and SQLite's
		// truncate optimization exempts that statement from the update hook the
		// listener is built on (expo-sqlite's vendored `sqlite3.h:7090-7095`). Adding
		// exchangeRates to the watched set was tried and does not fix it; this call
		// is what keeps the tiles honest after a refresh.
		void refreshRates(db).then((changed) => {
			if (changed) {
				publish.schedule();
			}
		});

		const listener = addDatabaseChangeListener((event) => {
			if (affectsWidgets(event.tableName)) {
				publish.schedule();
			}
			if (affectsSpotlight(event.tableName)) {
				reindex.schedule();
			}
		});

		const subscription = AppState.addEventListener("change", (state) => {
			// Background is the last moment the app can guarantee the tile behind it
			// is current.
			if (state === "active") {
				catchUp();
				void refreshRates(db).then((changed) => {
					if (changed) {
						publish.schedule();
					}
				});
			} else if (state === "background") {
				publish.cancel();
				reindex.cancel();
				void publishWidgets(db);
				void indexSpotlight(db);
			}
		});

		return () => {
			publish.cancel();
			reindex.cancel();
			listener.remove();
			subscription.remove();
		};
	}, [db]);
}

/**
 * Commits every transaction an App Intent accepted while the app was not
 * running, and answers how many landed. Goes through the same
 * `transactionsRepo.create` the form uses.
 */
async function applyPendingWrites(db: Database): Promise<number> {
	const jobs = drainPendingWrites();
	let applied = 0;
	for (const job of jobs) {
		const categoryId = await resolveCategory(db, job);
		if (!categoryId) {
			// Dropping beats inventing a category the user never made.
			console.warn("[outlayr] dropped a queued entry with no category");
			continue;
		}
		await transactionsRepo.create(db, {
			amount: job.amount,
			income: job.income,
			categoryId,
			note: job.note,
			details: null,
			date: new Date(job.date),
			// Null means "the ledger's own currency", which is what
			// `transactionsRepo.create` already resolves it to.
			currency: resolveWriteCurrency(job),
		});
		applied += 1;
	}
	return applied;
}

/**
 * Refreshes the local exchange-rate replica. `pullRatesIfDue` owns the 12-hour
 * throttle, and a build with no `EXPO_PUBLIC_CONVEX_URL` has no puller at all —
 * a failed or absent backend must cost nothing here.
 */
async function refreshRates(db: Database): Promise<boolean> {
	const pull = ratesPuller();
	if (!pull) {
		return false;
	}
	let changed = false;
	try {
		changed = await pullRatesIfDue(db, pull);
	} catch (error) {
		console.warn("[outlayr] rate refresh failed", error);
	}
	// Before canonicalizing, so a row about to be valued already names what it
	// was kept in — canonicalization skips the ones that still do not.
	try {
		changed = (await stampLedgerCurrency(db)) > 0 || changed;
	} catch (error) {
		console.warn("[outlayr] currency stamp failed", error);
	}
	// Always, not only after a successful pull: rows can be left unvalued by an
	// entry made offline even when the cache was already fresh, and the pass is
	// a no-op when there is nothing to do.
	try {
		changed = (await backfillCanonicalUsd(db)) > 0 || changed;
		changed = (await backfillBudgetUsd(db)) > 0 || changed;
	} catch (error) {
		console.warn("[outlayr] canonicalization backfill failed", error);
	}
	return changed;
}

/**
 * The currency a queued entry was actually in, or null to use the ledger's.
 *
 * An explicit code from the automation wins; otherwise the formatted amount is
 * read for one. Anything the catalog cannot pin to a single currency stays null
 * — see `detectCurrency`.
 */
function resolveWriteCurrency(job: PendingWrite): string | null {
	const pinned = job.currency?.trim().toUpperCase();
	if (pinned) {
		return pinned;
	}
	return detectCurrency(job.amountText);
}

/**
 * Works out where a queued entry belongs, best evidence first.
 *
 * 1. The category the intent named. A spoken name arrives with whatever casing
 *    Siri chose, so the match is case-insensitive.
 * 2. Failing that, wherever this same merchant was filed last time — a Wallet
 *    automation only ever knows a merchant string, never a category.
 * 3. Failing that, the first category on the right side of the ledger.
 */
async function resolveCategory(
	db: Database,
	job: PendingWrite,
): Promise<string | null> {
	if (job.category) {
		const named = await db
			.select({ id: categories.id })
			.from(categories)
			.where(
				and(
					like(categories.name, job.category),
					eq(categories.income, job.income),
					isNull(categories.deletedAt),
				),
			)
			.limit(1);
		if (named[0]) {
			return named[0].id;
		}
	}

	const note = job.note.trim();
	if (note) {
		const seenBefore = await db
			.select({ categoryId: transactions.categoryId })
			.from(transactions)
			.where(
				and(
					like(transactions.note, note),
					eq(transactions.income, job.income),
					isNull(transactions.deletedAt),
				),
			)
			.orderBy(desc(transactions.date))
			.limit(1);
		const previous = seenBefore[0]?.categoryId;
		if (previous) {
			return previous;
		}
	}

	const fallback = await db
		.select({ id: categories.id })
		.from(categories)
		.where(
			and(
				eq(categories.income, job.income),
				isNull(categories.parentId),
				isNull(categories.deletedAt),
			),
		)
		.limit(1);
	return fallback[0]?.id ?? null;
}
