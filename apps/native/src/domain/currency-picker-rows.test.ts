import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { currencyPickerRows } from "./currency-picker-rows";

const codes = (rows: ReturnType<typeof currencyPickerRows>) =>
	rows.flatMap((row) => (row.kind === "currency" ? [row.code] : []));

const sections = (rows: ReturnType<typeof currencyPickerRows>) =>
	rows.flatMap((row) => (row.kind === "header" ? [row.section] : []));

const hints = (rows: ReturnType<typeof currencyPickerRows>) =>
	rows.filter((row) => row.kind === "hint");

describe("the currency picker's rows", () => {
	it("teaches the gesture under an empty cluster, above the whole catalogue", () => {
		// Favouriting is a long-press with nothing drawn on the row to advertise it.
		// This line is the entire discoverability budget: it holds the cluster's
		// place until the first favourite earns it, then never appears again.
		const rows = currencyPickerRows([], "");
		assert.deepEqual(sections(rows), ["favourites", "all"]);
		assert.equal(hints(rows).length, 1);
		assert.deepEqual(codes(rows), [...PICKABLE_CURRENCY_CODES]);
	});

	it("retires the hint the moment a favourite exists", () => {
		assert.deepEqual(hints(currencyPickerRows(["USD"], "")), []);
	});

	it("keeps a search flat, hint included", () => {
		// A search is its own shortcut. Teaching the gesture mid-search would push
		// the match the user typed further down for no gain.
		assert.deepEqual(hints(currencyPickerRows([], "eur")), []);
	});

	it("clusters the favourites above the rest, each under its own header", () => {
		const rows = currencyPickerRows(["USD", "VES"], "");
		assert.deepEqual(sections(rows), ["favourites", "all"]);
		assert.deepEqual(codes(rows).slice(0, 2), ["USD", "VES"]);
	});

	it("never repeats a favourite in the list below the cluster", () => {
		// The catalogue pins USD and VES above its own alphabet, so a cluster that
		// repeated its codes put them back-to-back with themselves — two identical
		// pairs, no separator, reading as a plain duplication bug.
		const rows = currencyPickerRows(["USD", "VES"], "");
		const listed = codes(rows);
		assert.equal(listed.filter((code) => code === "USD").length, 1);
		assert.equal(listed.filter((code) => code === "VES").length, 1);
	});

	it("still offers every currency exactly once", () => {
		const listed = codes(currencyPickerRows(["JPY", "USD"], ""));
		assert.equal(listed.length, PICKABLE_CURRENCY_CODES.length);
		assert.equal(new Set(listed).size, PICKABLE_CURRENCY_CODES.length);
	});

	it("keeps every key distinct, which is what the list is keyed on", () => {
		const rows = currencyPickerRows(["USD", "VES"], "");
		assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
	});

	it("marks the cluster's rows as favourites and the rest as not", () => {
		const rows = currencyPickerRows(["USD"], "");
		const favourites = rows.filter(
			(row) => row.kind === "currency" && row.favourite,
		);
		assert.equal(favourites.length, 1);
		assert.equal(
			favourites[0].kind === "currency" && favourites[0].code,
			"USD",
		);
	});

	it("holds the order the favourites were added in", () => {
		const rows = currencyPickerRows(["VES", "USD"], "");
		assert.deepEqual(codes(rows).slice(0, 2), ["VES", "USD"]);
	});

	it("drops a stored favourite the catalogue no longer knows", () => {
		const rows = currencyPickerRows(["USD", "XXX"], "");
		assert.deepEqual(codes(rows).slice(0, 1), ["USD"]);
		assert.ok(!codes(rows).includes("XXX" as never));
	});

	it("leaves a search flat, because the search is already the shortcut", () => {
		// Clustering on top of a search pushes the match the user typed below the
		// fold.
		const rows = currencyPickerRows(["USD", "VES"], "eur");
		assert.deepEqual(sections(rows), []);
		assert.ok(codes(rows).includes("EUR"));
	});

	it("searches by code and by name, ignoring case and padding", () => {
		assert.ok(codes(currencyPickerRows([], "  JpY ")).includes("JPY"));
		assert.ok(codes(currencyPickerRows([], "yen")).includes("JPY"));
	});

	it("answers nothing for a search that matches nothing", () => {
		assert.deepEqual(currencyPickerRows([], "zzzzzz"), []);
	});
});

describe("where a section closes", () => {
	const lastCodes = (rows: ReturnType<typeof currencyPickerRows>) =>
		rows.flatMap((row) =>
			row.kind === "currency" && row.last ? [row.code] : [],
		);

	it("closes on the row before a header, and on the very last row", () => {
		// The row draws its own separator, so the one closing a section has to leave
		// it off or it stacks a hairline against the next header.
		const rows = currencyPickerRows(["USD", "VES"], "");
		const codes = lastCodes(rows);
		assert.equal(codes[0], "VES");
		assert.equal(codes.length, 2);
		assert.equal(codes[1], rows.at(-1)?.kind === "currency" ? codes[1] : null);
	});

	it("closes only the final row of a search", () => {
		const rows = currencyPickerRows([], "dollar");
		assert.equal(lastCodes(rows).length, 1);
	});

	it("closes the catalogue's last row when the cluster is empty", () => {
		assert.equal(lastCodes(currencyPickerRows([], "")).length, 1);
	});
});
