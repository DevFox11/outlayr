import { beforeEach, describe, expect, it } from "@jest/globals";

import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { readFavourites, toggleFavouriteCurrency, writeFavourites } from "./favourite-currencies-core";

const makeDb = migratedDatabase;

const EIGHT = ["USD", "EUR", "GBP", "JPY", "AED", "AFN", "ALL", "AMD"];
const NINTH = "ANG";

describe("favourite currencies storage", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
    });

    it("reads no favourites out of a table nobody has written", async () => {
        await expect(readFavourites(db)).resolves.toStrictEqual([]);
    });

    it("round-trips the list in the order it was written", async () => {
        await writeFavourites(db, ["JPY", "EUR", "GBP"]);
        await expect(readFavourites(db)).resolves.toStrictEqual(["JPY", "EUR", "GBP"]);
    });

    it("keeps the newest write rather than appending a second row", async () => {
        await writeFavourites(db, ["EUR"]);
        await writeFavourites(db, ["GBP", "JPY"]);
        await expect(readFavourites(db)).resolves.toStrictEqual(["GBP", "JPY"]);
    });

    it("adds a code and persists it", async () => {
        await expect(toggleFavouriteCurrency(db, "EUR")).resolves.toStrictEqual(["EUR"]);
        await expect(readFavourites(db)).resolves.toStrictEqual(["EUR"]);
    });

    it("removes a code it already holds", async () => {
        await writeFavourites(db, ["EUR", "GBP"]);
        await expect(toggleFavouriteCurrency(db, "EUR")).resolves.toStrictEqual(["GBP"]);
        await expect(readFavourites(db)).resolves.toStrictEqual(["GBP"]);
    });

    it("appends rather than reordering when adding to a held list", async () => {
        await writeFavourites(db, ["EUR", "GBP"]);
        await expect(toggleFavouriteCurrency(db, "JPY")).resolves.toStrictEqual(["EUR", "GBP", "JPY"]);
    });

    it("refuses a ninth and answers the eight unchanged", async () => {
        expect(EIGHT).toHaveLength(FAVOURITE_CURRENCY_LIMIT);
        await writeFavourites(db, EIGHT);
        await expect(toggleFavouriteCurrency(db, NINTH)).resolves.toStrictEqual(EIGHT);
        await expect(readFavourites(db)).resolves.toStrictEqual(EIGHT);
    });

    it("still lets a removal through at the limit", async () => {
        await writeFavourites(db, EIGHT);
        await expect(toggleFavouriteCurrency(db, "USD")).resolves.toStrictEqual(EIGHT.slice(1));
    });

    it("keeps both stars when two taps land before the first write", async () => {
        // Dispatched the way onPress does it — neither awaited — so both would read
        // the same empty list if the toggles did not serialise, and the second write
        // would erase the first.
        const [first, second] = await Promise.all([
            toggleFavouriteCurrency(db, "EUR"),
            toggleFavouriteCurrency(db, "JPY"),
        ]);
        expect(first).toStrictEqual(["EUR"]);
        expect(second).toStrictEqual(["EUR", "JPY"]);
        await expect(readFavourites(db)).resolves.toStrictEqual(["EUR", "JPY"]);
    });

    it("keeps taking toggles after one of them fails", async () => {
        const broken = {
            select() {
                throw new Error("read failed");
            },
        } as unknown as Parameters<typeof toggleFavouriteCurrency>[0];
        await expect(toggleFavouriteCurrency(broken, "EUR")).rejects.toThrow();
        await expect(toggleFavouriteCurrency(db, "GBP")).resolves.toStrictEqual(["GBP"]);
    });

    it("hides a retired code on read and leaves it stored until a toggle", async () => {
        await setMeta(db, META_KEYS.favouriteCurrencies, "EUR,XXX,GBP");
        await expect(readFavourites(db)).resolves.toStrictEqual(["EUR", "GBP"]);
        await expect(getMeta(db, META_KEYS.favouriteCurrencies)).resolves.toBe("EUR,XXX,GBP");

        await expect(toggleFavouriteCurrency(db, "JPY")).resolves.toStrictEqual(["EUR", "GBP", "JPY"]);
        await expect(getMeta(db, META_KEYS.favouriteCurrencies)).resolves.toBe("EUR,GBP,JPY");
    });
});
