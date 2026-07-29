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
	backfillCanonicalUsd,
	hasUncanonicalized,
	stampLedgerCurrency,
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
	row: { amount: number; currency: string | null; amountUsd?: number | null },
): Promise<string> {
	seq += 1;
	const id = `t${seq}`;
	await db.insert(transactions).values({
		id,
		amount: row.amount,
		income: false,
		currency: row.currency,
		date: JULY_28,
		day: JULY_28,
		month: JULY_28,
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
