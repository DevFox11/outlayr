import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import {
	FAVOURITE_CURRENCY_LIMIT,
	isFavourite,
	parseFavourites,
	serialiseFavourites,
	toggleFavourite,
} from "./favourite-currencies";

const TWELVE = [
	"USD",
	"VES",
	"AED",
	"AFN",
	"ALL",
	"AMD",
	"ANG",
	"AOA",
	"ARS",
	"AUD",
	"AWG",
	"AZN",
];

const EIGHT = TWELVE.slice(0, FAVOURITE_CURRENCY_LIMIT);

describe("parseFavourites", () => {
	it("reads an unset and an empty setting as no favourites", () => {
		assert.deepEqual(parseFavourites(null), []);
		assert.deepEqual(parseFavourites(""), []);
	});

	it("uppercases what it reads back", () => {
		assert.deepEqual(parseFavourites("eur,usd"), ["EUR", "USD"]);
	});

	it("trims the padding a hand-edited value would carry", () => {
		assert.deepEqual(parseFavourites(" eur ,\tusd "), ["EUR", "USD"]);
	});

	it("keeps the first sighting of a duplicate and drops the rest", () => {
		assert.deepEqual(parseFavourites("EUR,EUR,JPY"), ["EUR", "JPY"]);
		assert.deepEqual(parseFavourites("EUR,JPY,eur"), ["EUR", "JPY"]);
	});

	it("drops anything the catalogue does not know rather than keeping it", () => {
		assert.deepEqual(parseFavourites("EUR,XXX,JPY"), ["EUR", "JPY"]);
		assert.deepEqual(parseFavourites("EUR,,JPY"), ["EUR", "JPY"]);
		assert.deepEqual(parseFavourites("EUR, ,JPY"), ["EUR", "JPY"]);
		assert.deepEqual(parseFavourites("XXX"), []);
		assert.deepEqual(parseFavourites(",,,"), []);
	});

	it("caps a longer stored list at the limit, keeping the first ones", () => {
		assert.equal(TWELVE.length, 12);
		assert.deepEqual(parseFavourites(TWELVE.join(",")), EIGHT);
	});

	it("counts only the codes it kept towards the cap", () => {
		// Interleaved rubbish: were it counted, the cap would land after four
		// real codes instead of eight.
		const padded = EIGHT.flatMap((code, index) => [code, `XX${index}`]);
		assert.deepEqual(parseFavourites(padded.join(",")), EIGHT);
	});
});

describe("serialiseFavourites", () => {
	it("writes the comma-separated shape the setting stores", () => {
		assert.equal(serialiseFavourites(["EUR", "JPY"]), "EUR,JPY");
		assert.equal(serialiseFavourites([]), "");
	});

	it("round-trips every code in the catalogue", () => {
		for (
			let start = 0;
			start < PICKABLE_CURRENCY_CODES.length;
			start += FAVOURITE_CURRENCY_LIMIT
		) {
			const chunk = PICKABLE_CURRENCY_CODES.slice(
				start,
				start + FAVOURITE_CURRENCY_LIMIT,
			);
			assert.deepEqual(parseFavourites(serialiseFavourites(chunk)), [...chunk]);
		}
	});
});

describe("toggleFavourite", () => {
	it("appends an absent code to the end", () => {
		assert.deepEqual(toggleFavourite(["EUR", "JPY"], "GBP"), [
			"EUR",
			"JPY",
			"GBP",
		]);
		assert.deepEqual(toggleFavourite([], "GBP"), ["GBP"]);
	});

	it("appends in the catalogue's casing whatever casing it is handed", () => {
		assert.deepEqual(toggleFavourite(["EUR"], "gbp"), ["EUR", "GBP"]);
	});

	it("removes from the middle without disturbing the order", () => {
		assert.deepEqual(toggleFavourite(["EUR", "JPY", "GBP"], "JPY"), [
			"EUR",
			"GBP",
		]);
		assert.deepEqual(toggleFavourite(["EUR", "JPY", "GBP"], "jpy"), [
			"EUR",
			"GBP",
		]);
	});

	it("returns the list unchanged when adding a ninth", () => {
		assert.equal(EIGHT.length, FAVOURITE_CURRENCY_LIMIT);
		assert.deepEqual(toggleFavourite(EIGHT, "JPY"), EIGHT);
	});

	it("still lets a full list be shortened", () => {
		assert.deepEqual(toggleFavourite(EIGHT, "USD"), EIGHT.slice(1));
	});

	it("refuses a code the catalogue does not know", () => {
		assert.deepEqual(toggleFavourite(["EUR"], "XXX"), ["EUR"]);
		assert.deepEqual(toggleFavourite(["EUR"], " "), ["EUR"]);
	});

	it("never mutates the list it is handed", () => {
		const codes = ["EUR", "JPY"];
		toggleFavourite(codes, "GBP");
		toggleFavourite(codes, "EUR");
		assert.deepEqual(codes, ["EUR", "JPY"]);
	});
});

describe("isFavourite", () => {
	it("matches whatever casing the caller has", () => {
		assert.equal(isFavourite(["EUR", "JPY"], "eur"), true);
		assert.equal(isFavourite(["EUR", "JPY"], "EUR"), true);
		assert.equal(isFavourite(["EUR", "JPY"], " jpy "), true);
	});

	it("is false for a code that is not there", () => {
		assert.equal(isFavourite(["EUR", "JPY"], "GBP"), false);
		assert.equal(isFavourite([], "EUR"), false);
	});
});
