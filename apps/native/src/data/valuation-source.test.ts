import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { appMeta, exchangeRates } from "@/db/schema";
import type { SpendDb } from "./budget-spent";
import { loadValuation, loadValuationIn } from "./valuation-source";

const NOW = 1_700_000_000_000;
const DAY = "2026-07-28";
const LATER_DAY = "2026-07-29";

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
	`);
	return drizzle(sqlite) as unknown as SpendDb;
}

const OFFICIAL_VES = 45.5;
const BINANCE_VES = 61.25;

async function seed(db: SpendDb): Promise<void> {
	await db.insert(exchangeRates).values([
		{
			quote: "EUR",
			rateType: "official",
			date: "2026-07-20",
			rate: 0.87,
			source: "frankfurter",
			fetchedAt: NOW,
		},
		{
			quote: "EUR",
			rateType: "official",
			date: DAY,
			rate: 0.86,
			source: "frankfurter",
			fetchedAt: NOW,
		},
		{
			quote: "JPY",
			rateType: "official",
			date: "2026-07-20",
			rate: 155.4,
			source: "frankfurter",
			fetchedAt: NOW,
		},
		{
			quote: "JPY",
			rateType: "official",
			date: DAY,
			rate: 157.1,
			source: "frankfurter",
			fetchedAt: NOW,
		},
		{
			quote: "VES",
			rateType: "official",
			date: DAY,
			rate: OFFICIAL_VES,
			source: "bcv",
			fetchedAt: NOW,
		},
		// Straddling the official day on both sides, so a table that mixed the
		// types would answer differently at every day asked about rather than
		// depending on which row the scan happened to hand back first.
		{
			quote: "VES",
			rateType: "eur_reference",
			date: LATER_DAY,
			rate: 52.75,
			source: "bcv",
			fetchedAt: NOW,
		},
		{
			quote: "VES",
			rateType: "binance",
			date: LATER_DAY,
			rate: BINANCE_VES,
			source: "binance",
			fetchedAt: NOW,
		},
		{
			quote: "VES",
			rateType: "binance",
			date: "2026-07-10",
			rate: 58.5,
			source: "binance",
			fetchedAt: NOW,
		},
	]);
}

describe("loadValuationIn", () => {
	it("answers for a quote nobody has as their display currency", async () => {
		const db = makeDb();
		await seed(db);

		const { displayCurrency, rates } = await loadValuationIn(db, "JPY");

		expect(displayCurrency).toBe("JPY");
		expect(rates.get("JPY", DAY)).toBe(157.1);
		expect(rates.earliest("JPY")).toBe("2026-07-20");
	});

	it("reads back the newest rate on or before the day asked for", async () => {
		const db = makeDb();
		await seed(db);

		const { rates } = await loadValuationIn(db, "JPY");

		expect(rates.get("JPY", "2026-07-24")).toBe(155.4);
	});

	it("carries no rows for the currency it is not asked about", async () => {
		const db = makeDb();
		await seed(db);

		const { rates } = await loadValuationIn(db, "JPY");

		expect(rates.get("EUR", DAY)).toBe(null);
	});

	it("hands back an empty table for USD", async () => {
		const db = makeDb();
		await seed(db);

		const { displayCurrency, rates } = await loadValuationIn(db, "USD");

		expect(displayCurrency).toBe("USD");
		expect(rates.get("USD", DAY)).toBe(null);
		expect(rates.earliest("USD")).toBe(null);
	});

	it("takes only the official rate where a quote carries several types", async () => {
		// VES publishes official, eur_reference and binance. A figure frozen at the
		// official rate converted back out at binance is a number that was never true.
		const db = makeDb();
		await seed(db);

		const { rates } = await loadValuationIn(db, "VES");

		expect(rates.get("VES", LATER_DAY)).toBe(OFFICIAL_VES);
		expect(rates.earliest("VES")).toBe(DAY);
	});

	it("distinguishes a quote with no rows from one with a floor", async () => {
		// `earliest` is what predatesHistory reads to call a day unreachable rather
		// than unfetched, so an absence must not answer with a date.
		const db = makeDb();
		await seed(db);

		const { rates } = await loadValuationIn(db, "CHF");

		expect(rates.get("CHF", DAY)).toBe(null);
		expect(rates.earliest("CHF")).toBe(null);
	});
});

describe("loadValuation", () => {
	it("resolves the quote from the stored display currency", async () => {
		const db = makeDb();
		await seed(db);
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });

		const stored = await loadValuation(db);
		const explicit = await loadValuationIn(db, "EUR");

		expect(stored.displayCurrency).toBe(explicit.displayCurrency);
		expect(stored.rates.get("EUR", DAY)).toBe(explicit.rates.get("EUR", DAY));
		expect(stored.rates.earliest("EUR")).toBe(explicit.rates.earliest("EUR"));
		expect(stored.rates.get("EUR", DAY)).toBe(0.86);
	});

	it("falls back to USD when nothing is stored", async () => {
		const db = makeDb();
		await seed(db);

		const { displayCurrency, rates } = await loadValuation(db);

		expect(displayCurrency).toBe("USD");
		expect(rates.earliest("USD")).toBe(null);
	});
});
