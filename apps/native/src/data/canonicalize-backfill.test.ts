import assert from "node:assert/strict";
import { describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
	appMeta,
	budgets,
	exchangeRates,
	mainBudget,
	transactions,
} from "@/db/schema";
import type { SpendDb } from "./budget-spent";
import {
	backfillBudgetUsd,
	backfillCanonicalUsd,
	CANONICALIZE_BATCH,
	hasUncanonicalized,
	stampLedgerCurrency,
	valuationCoverage,
} from "./canonicalize-backfill";

function makeDb(): SpendDb {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
		CREATE TABLE exchangeRates (
			quote text NOT NULL,
			rateType text NOT NULL,
			date text NOT NULL,
			rate real NOT NULL,
			source text NOT NULL,
			fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
		CREATE TABLE budgets (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			categoryId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE mainBudget (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			currency text,
			note text NOT NULL DEFAULT '',
			details text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			categoryId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as SpendDb;
}

const JULY_28 = new Date(Date.UTC(2026, 6, 28, 12));

async function seedRate(db: SpendDb): Promise<void> {
	await db.insert(exchangeRates).values({
		quote: "EUR",
		date: "2026-07-28",
		rateType: "official",
		rate: 0.87775,
		source: "frankfurter",
		fetchedAt: JULY_28.getTime(),
	});
}

let seq = 0;
async function add(
	db: SpendDb,
	row: {
		amount: number;
		currency: string | null;
		amountUsd?: number | null;
		date?: Date;
	},
): Promise<string> {
	seq += 1;
	const id = `t${seq}`;
	const date = row.date ?? JULY_28;
	await db.insert(transactions).values({
		id,
		amount: row.amount,
		income: false,
		currency: row.currency,
		date,
		day: date,
		month: date,
		amountUsd: row.amountUsd ?? null,
		updatedAt: JULY_28,
	});
	return id;
}

describe("stampLedgerCurrency", () => {
	it("names the ledger's currency on rows that stated none", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await add(db, { amount: 18.5, currency: null });
		await add(db, { amount: 100, currency: "JPY" });

		assert.equal(await stampLedgerCurrency(db), 1);
		const rows = await db
			.select({ id: transactions.id, currency: transactions.currency })
			.from(transactions);
		assert.deepEqual(rows.map((row) => row.currency).sort(), ["EUR", "JPY"]);
	});

	it("leaves a row that already named one alone", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await add(db, { amount: 100, currency: "JPY" });

		assert.equal(await stampLedgerCurrency(db), 0);
		const [row] = await db
			.select({ currency: transactions.currency })
			.from(transactions);
		assert.equal(row.currency, "JPY");
	});

	it("refuses when the ledger never set one", async () => {
		const db = makeDb();
		await add(db, { amount: 10, currency: null });

		assert.equal(await stampLedgerCurrency(db), 0);
		const [row] = await db
			.select({ currency: transactions.currency })
			.from(transactions);
		assert.equal(row.currency, null);
	});

	it("refuses when the default is all bootstrap ever wrote", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "USD" });
		await add(db, { amount: 10, currency: null });

		assert.equal(await stampLedgerCurrency(db), 0);
		const [row] = await db
			.select({ currency: transactions.currency })
			.from(transactions);
		assert.equal(row.currency, null);
	});

	it("stamps the default once the user has stated it", async () => {
		const db = makeDb();
		await db.insert(appMeta).values([
			{ key: "currency", value: "USD" },
			{ key: "currencyChosen", value: "true" },
		]);
		await add(db, { amount: 10, currency: null });

		assert.equal(await stampLedgerCurrency(db), 1);
		const [row] = await db
			.select({ currency: transactions.currency })
			.from(transactions);
		assert.equal(row.currency, "USD");
	});

	it("is a no-op on a second pass", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await add(db, { amount: 10, currency: null });

		await stampLedgerCurrency(db);
		assert.equal(await stampLedgerCurrency(db), 0);
	});
});

describe("a row kept under a currency nobody stated", () => {
	it("is never frozen at rate 1", async () => {
		// Stamping the bootstrap default takes canonicalization's USD identity
		// branch, which turns "follow the setting" into a stored fact the user
		// never gave — and no later pass looks at the row again.
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "USD" });
		const id = await add(db, { amount: 18.5, currency: null });

		await stampLedgerCurrency(db);
		await backfillCanonicalUsd(db);

		const [row] = await db
			.select({
				currency: transactions.currency,
				amountUsd: transactions.amountUsd,
				exchangeRate: transactions.exchangeRate,
			})
			.from(transactions)
			.where(eq(transactions.id, id));
		assert.equal(row.currency, null);
		assert.equal(row.amountUsd, null);
		assert.equal(row.exchangeRate, null);
	});

	it("does not hold up a row the backfill can value", async () => {
		const db = makeDb();
		await seedRate(db);
		await db.insert(appMeta).values({ key: "currency", value: "USD" });
		await add(db, { amount: 18.5, currency: null });
		await add(db, { amount: 100, currency: "EUR" });

		assert.equal(await backfillCanonicalUsd(db), 1);
	});
});

describe("backfillCanonicalUsd", () => {
	it("freezes a stamped foreign row at the rate of its own day", async () => {
		const db = makeDb();
		await seedRate(db);
		await db.insert(appMeta).values({ key: "currency", value: "USD" });
		await add(db, { amount: 100, currency: "EUR" });

		assert.equal(await backfillCanonicalUsd(db), 1);
		const [row] = await db
			.select({
				amountUsd: transactions.amountUsd,
				exchangeRate: transactions.exchangeRate,
				exchangeRateType: transactions.exchangeRateType,
			})
			.from(transactions);
		// 100 EUR / 0.87775 — the divisor is currency-per-USD.
		assert.equal(Math.round((row.amountUsd ?? 0) * 100) / 100, 113.93);
		assert.equal(row.exchangeRate, 0.87775);
		assert.equal(row.exchangeRateType, "official");
	});

	it("leaves a row it cannot value for the next pass to retry", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "USD" });
		await add(db, { amount: 100, currency: "EUR" });

		assert.equal(await backfillCanonicalUsd(db), 0);
		assert.equal(await hasUncanonicalized(db), true);
	});
});

describe("hasUncanonicalized", () => {
	it("does not count a row that states no currency", async () => {
		// `backfillCanonicalUsd` excludes those in SQL, so counting them as pending
		// leaves a ledger nobody ever named a currency for reporting a backlog no
		// pass can ever drain.
		const db = makeDb();
		await add(db, { amount: 18.5, currency: null });

		assert.equal(await hasUncanonicalized(db), false);
	});
});

describe("valuationCoverage", () => {
	it("reports nothing outstanding once every row is frozen", async () => {
		const db = makeDb();
		await add(db, { amount: 100, currency: "EUR", amountUsd: 113.9 });
		await add(db, { amount: 20, currency: null });

		assert.deepEqual(await valuationCoverage(db), {
			converted: 1,
			pending: 0,
			beyondRateHistory: 0,
		});
	});

	it("separates rows a later pull can reach from ones it never will", async () => {
		// The rate table holds EUR from 2026-07-28 on. An EUR row older than that
		// is not waiting for anything: every pull wipe-replaces the table with a
		// window that starts no earlier.
		const db = makeDb();
		await seedRate(db);
		await add(db, { amount: 100, currency: "EUR", amountUsd: 113.9 });
		await add(db, { amount: 40, currency: "EUR" });
		await add(db, {
			amount: 55,
			currency: "EUR",
			date: new Date(Date.UTC(2025, 0, 9, 12)),
		});

		assert.deepEqual(await valuationCoverage(db), {
			converted: 1,
			pending: 1,
			beyondRateHistory: 1,
		});
	});

	it("leaves a currency with no rates at all pending", async () => {
		// Rates for it may still arrive; "never" is not claimable from an absence.
		const db = makeDb();
		await seedRate(db);
		await add(db, {
			amount: 900,
			currency: "JPY",
			date: new Date(Date.UTC(2025, 0, 9, 12)),
		});

		assert.deepEqual(await valuationCoverage(db), {
			converted: 0,
			pending: 1,
			beyondRateHistory: 0,
		});
	});

	it("never calls a USD row unreachable", async () => {
		// It freezes at rate 1 with no rate consulted, however old it is.
		const db = makeDb();
		await seedRate(db);
		await add(db, {
			amount: 12,
			currency: "USD",
			date: new Date(Date.UTC(2020, 2, 1, 12)),
		});

		assert.deepEqual(await valuationCoverage(db), {
			converted: 0,
			pending: 1,
			beyondRateHistory: 0,
		});
	});
});

describe("stampLedgerCurrency over budgets", () => {
	it("names the ledger's currency on a budget that stated none", async () => {
		// Left bare, a budget's amount follows the display setting, so switching it
		// would restate a 2,400 target the user never touched.
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: null,
			updatedAt: JULY_28,
		});
		await db.insert(mainBudget).values({
			id: "m1",
			amount: 2400,
			type: 3,
			currency: null,
			updatedAt: JULY_28,
		});

		// One transaction-less ledger: the count is the two budgets.
		assert.equal(await stampLedgerCurrency(db), 2);
		const [b] = await db.select({ currency: budgets.currency }).from(budgets);
		const [m] = await db
			.select({ currency: mainBudget.currency })
			.from(mainBudget);
		assert.equal(b.currency, "EUR");
		assert.equal(m.currency, "EUR");
	});

	it("leaves a budget that already named one alone", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "GBP",
			updatedAt: JULY_28,
		});

		assert.equal(await stampLedgerCurrency(db), 0);
		const [b] = await db.select({ currency: budgets.currency }).from(budgets);
		assert.equal(b.currency, "GBP");
	});
});

const JULY_1 = new Date(Date.UTC(2026, 6, 1, 12));

async function seedJulyRates(db: SpendDb): Promise<void> {
	await seedRate(db);
	await db.insert(exchangeRates).values({
		quote: "EUR",
		date: "2026-07-01",
		rateType: "official",
		rate: 0.8,
		source: "frankfurter",
		fetchedAt: JULY_1.getTime(),
	});
}

async function budgetUsd(db: SpendDb, id: string): Promise<number | null> {
	const [row] = await db
		.select({ amountUsd: budgets.amountUsd })
		.from(budgets)
		.where(eq(budgets.id, id));
	return row?.amountUsd ?? null;
}

describe("backfillBudgetUsd", () => {
	it("values a target at the day it was created, not at today's rate", async () => {
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 1);
		// 400 / 0.8, not 400 / 0.87775 — the divisor is currency-per-USD.
		assert.equal(await budgetUsd(db, "b1"), 500);
	});

	it("falls back to the window start when no creation date was kept", async () => {
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: null,
			startDate: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 1);
		assert.equal(await budgetUsd(db, "b1"), 500);
	});

	it("skips a target that names no currency", async () => {
		// `stampLedgerCurrency` runs first; freezing it here would claim a currency
		// the user never stated.
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: null,
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 0);
		assert.equal(await budgetUsd(db, "b1"), null);
	});

	it("leaves a target it cannot value for the next pass to retry", async () => {
		const db = makeDb();
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 0);
		assert.equal(await budgetUsd(db, "b1"), null);
	});

	it("freezes a USD target without consulting a rate", async () => {
		const db = makeDb();
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "USD",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 1);
		assert.equal(await budgetUsd(db, "b1"), 400);
	});

	it("covers the main budget alongside the per-category ones", async () => {
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});
		await db.insert(mainBudget).values({
			id: "m1",
			amount: 2400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 2);
		const [m] = await db
			.select({ amountUsd: mainBudget.amountUsd })
			.from(mainBudget);
		assert.equal(m.amountUsd, 3000);
	});

	it("is a no-op on a second pass", async () => {
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
		});

		await backfillBudgetUsd(db);
		assert.equal(await backfillBudgetUsd(db), 0);
	});

	it("ignores a soft-deleted target", async () => {
		const db = makeDb();
		await seedJulyRates(db);
		await db.insert(budgets).values({
			id: "b1",
			amount: 400,
			type: 3,
			currency: "EUR",
			dateCreated: JULY_1,
			updatedAt: JULY_28,
			deletedAt: JULY_28,
		});

		assert.equal(await backfillBudgetUsd(db), 0);
		assert.equal(await budgetUsd(db, "b1"), null);
	});
});

describe("backfillCanonicalUsd over a backlog", () => {
	async function addMany(
		db: SpendDb,
		count: number,
		currency: string,
		firstId: number,
	): Promise<void> {
		await db.insert(transactions).values(
			Array.from({ length: count }, (_, i) => ({
				id: `r${String(firstId + i).padStart(5, "0")}`,
				amount: 100,
				income: false,
				currency,
				date: JULY_28,
				day: JULY_28,
				month: JULY_28,
				amountUsd: null,
				updatedAt: JULY_28,
			})),
		);
	}

	it("drains a backlog wider than one batch in a single pass", async () => {
		const db = makeDb();
		await seedRate(db);
		const total = CANONICALIZE_BATCH + 60;
		await addMany(db, total, "EUR", 0);

		assert.equal(await backfillCanonicalUsd(db), total);
		assert.equal(await hasUncanonicalized(db), false);
	});

	it("steps past rows it cannot value rather than re-reading them", async () => {
		// Unvaluable rows keep their place in the predicate, so a pass that does not
		// advance past them re-reads the same page until the app is killed.
		const db = makeDb();
		await seedRate(db);
		await addMany(db, CANONICALIZE_BATCH, "EUR", 0);
		await addMany(db, 300, "JPY", 1000);
		await addMany(db, 40, "EUR", 2000);

		assert.equal(await backfillCanonicalUsd(db), CANONICALIZE_BATCH + 40);
		assert.equal(await hasUncanonicalized(db), true);
	});
});
