import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { readFavourites, toggleFavouriteCurrency, writeFavourites } from "./favourite-currencies-core";

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const EIGHT = ["USD", "EUR", "GBP", "JPY", "AED", "AFN", "ALL", "AMD"];
const NINTH = "ANG";

describe("favourite currencies storage", () => {
	let db: Database;

	beforeEach(() => {
		db = makeDb();
	});

	it("reads no favourites out of a table nobody has written", async () => {
		expect(await readFavourites(db)).toStrictEqual([]);
	});

	it("round-trips the list in the order it was written", async () => {
		await writeFavourites(db, ["JPY", "EUR", "GBP"]);
		expect(await readFavourites(db)).toStrictEqual(["JPY", "EUR", "GBP"]);
	});

	it("keeps the newest write rather than appending a second row", async () => {
		await writeFavourites(db, ["EUR"]);
		await writeFavourites(db, ["GBP", "JPY"]);
		expect(await readFavourites(db)).toStrictEqual(["GBP", "JPY"]);
	});

	it("adds a code and persists it", async () => {
		expect(await toggleFavouriteCurrency(db, "EUR")).toStrictEqual(["EUR"]);
		expect(await readFavourites(db)).toStrictEqual(["EUR"]);
	});

	it("removes a code it already holds", async () => {
		await writeFavourites(db, ["EUR", "GBP"]);
		expect(await toggleFavouriteCurrency(db, "EUR")).toStrictEqual(["GBP"]);
		expect(await readFavourites(db)).toStrictEqual(["GBP"]);
	});

	it("appends rather than reordering when adding to a held list", async () => {
		await writeFavourites(db, ["EUR", "GBP"]);
		expect(await toggleFavouriteCurrency(db, "JPY")).toStrictEqual(["EUR", "GBP", "JPY"]);
	});

	it("refuses a ninth and answers the eight unchanged", async () => {
		expect(EIGHT.length).toBe(FAVOURITE_CURRENCY_LIMIT);
		await writeFavourites(db, EIGHT);
		expect(await toggleFavouriteCurrency(db, NINTH)).toStrictEqual(EIGHT);
		expect(await readFavourites(db)).toStrictEqual(EIGHT);
	});

	it("still lets a removal through at the limit", async () => {
		await writeFavourites(db, EIGHT);
		expect(await toggleFavouriteCurrency(db, "USD")).toStrictEqual(EIGHT.slice(1));
	});

	it("keeps both stars when two taps land before the first write", async () => {
		// Dispatched the way onPress does it — neither awaited — so both would read
		// the same empty list if the toggles did not serialise, and the second write
		// would erase the first.
		const [first, second] = await Promise.all([toggleFavouriteCurrency(db, "EUR"), toggleFavouriteCurrency(db, "JPY")]);
		expect(first).toStrictEqual(["EUR"]);
		expect(second).toStrictEqual(["EUR", "JPY"]);
		expect(await readFavourites(db)).toStrictEqual(["EUR", "JPY"]);
	});

	it("keeps taking toggles after one of them fails", async () => {
		const broken = {
			select() {
				throw new Error("read failed");
			},
		} as unknown as Parameters<typeof toggleFavouriteCurrency>[0];
		await expect(toggleFavouriteCurrency(broken, "EUR")).rejects.toThrow();
		expect(await toggleFavouriteCurrency(db, "GBP")).toStrictEqual(["GBP"]);
	});

	it("hides a retired code on read and leaves it stored until a toggle", async () => {
		await setMeta(db, META_KEYS.favouriteCurrencies, "EUR,XXX,GBP");
		expect(await readFavourites(db)).toStrictEqual(["EUR", "GBP"]);
		expect(await getMeta(db, META_KEYS.favouriteCurrencies)).toBe("EUR,XXX,GBP");

		expect(await toggleFavouriteCurrency(db, "JPY")).toStrictEqual(["EUR", "GBP", "JPY"]);
		expect(await getMeta(db, META_KEYS.favouriteCurrencies)).toBe("EUR,GBP,JPY");
	});
});
