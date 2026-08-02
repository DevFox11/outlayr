import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { exchangeRates } from "@/db/schema";
import { logCurrencyOptions } from "@/domain/log-currency-options";
import { buildRateTable, valueExactIn } from "@/domain/valuation";
import { VALUATION_RATE_TYPE } from "./valuation-source";

const NOW = 1_700_000_000_000;

type Db = ReturnType<typeof drizzle>;

function makeDb(): Db {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
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
	return drizzle(sqlite);
}

function seed(db: Db): void {
	db.insert(exchangeRates)
		.values(
			["AED", "EUR", "JPY"].map((quote) => ({
				quote,
				rateType: VALUATION_RATE_TYPE,
				date: "2026-07-30",
				rate: 3.67,
				source: "frankfurter",
				fetchedAt: NOW,
			})),
		)
		.run();
}

/** What `useValuedCurrencies` reads, without the React wrapper. */
const valued = (db: Db): ReadonlySet<string> =>
	new Set(
		db
			.selectDistinct({ quote: exchangeRates.quote })
			.from(exchangeRates)
			.where(eq(exchangeRates.rateType, VALUATION_RATE_TYPE))
			.all()
			.map((row) => row.quote),
	);

/** What `useValuationIn` reads — one currency, which is all a conversion needs. */
const ratesFor = (db: Db, code: string) =>
	buildRateTable(
		db
			.select({
				quote: exchangeRates.quote,
				date: exchangeRates.date,
				rate: exchangeRates.rate,
			})
			.from(exchangeRates)
			.where(eq(exchangeRates.quote, code))
			.all(),
	);

describe("what the Log's currency chip may offer", () => {
	it("offers a favourite the rate table can reach", () => {
		// The regression this file exists for (#237). The chip used to test
		// convertibility against the rate table for the currency ALREADY ON SCREEN,
		// which holds one currency, so it answered no for every favourite and the
		// chip silently offered none of them.
		const db = makeDb();
		seed(db);
		expect(
			logCurrencyOptions({
				global: "USD",
				favourites: ["AED", "EUR"],
				produced: [],
				convertible: (code) => code === "USD" || valued(db).has(code),
			}),
		).toStrictEqual(["USD", "AED", "EUR"]);
	});

	it("is exactly what the old predicate got wrong", () => {
		// Same data, same favourites, asked of the one-currency table: nothing.
		const db = makeDb();
		seed(db);
		const rates = ratesFor(db, "USD");
		expect(
			logCurrencyOptions({
				global: "USD",
				favourites: ["AED", "EUR"],
				produced: [],
				convertible: (code) => code === "USD" || rates.earliest(code) !== null,
			}),
		).toStrictEqual(["USD"]);
	});

	it("still drops a favourite no rate can reach", () => {
		const db = makeDb();
		seed(db);
		expect(
			logCurrencyOptions({
				global: "USD",
				favourites: ["AED", "XXX"],
				produced: [],
				convertible: (code) => code === "USD" || valued(db).has(code),
			}),
		).toStrictEqual(["USD", "AED"]);
	});

	it("offers USD without a row of its own", () => {
		// USD is the canonical side of every stored rate, so it is reachable even
		// though `exchangeRates` never quotes it.
		const db = makeDb();
		seed(db);
		expect(!valued(db).has("USD")).toBeTruthy();
		expect(
			logCurrencyOptions({
				global: "AED",
				favourites: ["USD"],
				produced: [],
				convertible: (code) => code === "USD" || valued(db).has(code),
			}),
		).toStrictEqual(["AED", "USD"]);
	});

	it("offers USD on a ledger that has never pulled a rate, and means it", () => {
		// `convertible` admits USD unconditionally, which only holds because a USD
		// display never reaches the rate table: it reads the row's frozen
		// `amountUsd`. So USD is a real option on an empty table, not a dead one.
		const db = makeDb();
		expect(valued(db).size).toBe(0);
		expect(
			logCurrencyOptions({
				global: "AED",
				favourites: ["USD"],
				produced: [],
				convertible: (code) => code === "USD" || valued(db).has(code),
			}),
		).toStrictEqual(["AED", "USD"]);
		expect(
			valueExactIn(
				{ amount: 36.7, amountUsd: 10, currency: "AED", dateKey: "2026-07-30" },
				"USD",
				buildRateTable([]),
			),
		).toBe(10);
	});

	it("answers nothing on a ledger that has never pulled a rate", () => {
		const db = makeDb();
		expect(valued(db).size).toBe(0);
		expect(
			logCurrencyOptions({
				global: "USD",
				favourites: ["AED"],
				produced: [],
				convertible: (code) => code === "USD" || valued(db).has(code),
			}),
		).toStrictEqual(["USD"]);
	});
});
