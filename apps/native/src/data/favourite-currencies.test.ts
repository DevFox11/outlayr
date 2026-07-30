import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import {
	readFavourites,
	toggleFavouriteCurrency,
	writeFavourites,
} from "./favourite-currencies-core";

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
		assert.deepEqual(await readFavourites(db), []);
	});

	it("round-trips the list in the order it was written", async () => {
		await writeFavourites(db, ["JPY", "EUR", "GBP"]);
		assert.deepEqual(await readFavourites(db), ["JPY", "EUR", "GBP"]);
	});

	it("keeps the newest write rather than appending a second row", async () => {
		await writeFavourites(db, ["EUR"]);
		await writeFavourites(db, ["GBP", "JPY"]);
		assert.deepEqual(await readFavourites(db), ["GBP", "JPY"]);
	});

	it("adds a code and persists it", async () => {
		assert.deepEqual(await toggleFavouriteCurrency(db, "EUR"), ["EUR"]);
		assert.deepEqual(await readFavourites(db), ["EUR"]);
	});

	it("removes a code it already holds", async () => {
		await writeFavourites(db, ["EUR", "GBP"]);
		assert.deepEqual(await toggleFavouriteCurrency(db, "EUR"), ["GBP"]);
		assert.deepEqual(await readFavourites(db), ["GBP"]);
	});

	it("appends rather than reordering when adding to a held list", async () => {
		await writeFavourites(db, ["EUR", "GBP"]);
		assert.deepEqual(await toggleFavouriteCurrency(db, "JPY"), [
			"EUR",
			"GBP",
			"JPY",
		]);
	});

	it("refuses a ninth and answers the eight unchanged", async () => {
		assert.equal(EIGHT.length, FAVOURITE_CURRENCY_LIMIT);
		await writeFavourites(db, EIGHT);
		assert.deepEqual(await toggleFavouriteCurrency(db, NINTH), EIGHT);
		assert.deepEqual(await readFavourites(db), EIGHT);
	});

	it("still lets a removal through at the limit", async () => {
		await writeFavourites(db, EIGHT);
		assert.deepEqual(await toggleFavouriteCurrency(db, "USD"), EIGHT.slice(1));
	});

	it("keeps both stars when two taps land before the first write", async () => {
		// Dispatched the way onPress does it — neither awaited — so both would read
		// the same empty list if the toggles did not serialise, and the second write
		// would erase the first.
		const [first, second] = await Promise.all([
			toggleFavouriteCurrency(db, "EUR"),
			toggleFavouriteCurrency(db, "JPY"),
		]);
		assert.deepEqual(first, ["EUR"]);
		assert.deepEqual(second, ["EUR", "JPY"]);
		assert.deepEqual(await readFavourites(db), ["EUR", "JPY"]);
	});

	it("keeps taking toggles after one of them fails", async () => {
		const broken = {
			select() {
				throw new Error("read failed");
			},
		} as unknown as Parameters<typeof toggleFavouriteCurrency>[0];
		await assert.rejects(toggleFavouriteCurrency(broken, "EUR"));
		assert.deepEqual(await toggleFavouriteCurrency(db, "GBP"), ["GBP"]);
	});

	it("hides a retired code on read and leaves it stored until a toggle", async () => {
		await setMeta(db, META_KEYS.favouriteCurrencies, "EUR,XXX,GBP");
		assert.deepEqual(await readFavourites(db), ["EUR", "GBP"]);
		assert.equal(
			await getMeta(db, META_KEYS.favouriteCurrencies),
			"EUR,XXX,GBP",
		);

		assert.deepEqual(await toggleFavouriteCurrency(db, "JPY"), [
			"EUR",
			"GBP",
			"JPY",
		]);
		assert.equal(
			await getMeta(db, META_KEYS.favouriteCurrencies),
			"EUR,GBP,JPY",
		);
	});
});
