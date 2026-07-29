import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCsvRow, parseCsv } from "./csv";

describe("formatCsvRow", () => {
	it("leaves plain fields bare", () => {
		assert.equal(formatCsvRow(["Bakery", "12.50", "EUR"]), "Bakery,12.50,EUR");
	});

	it("quotes a field containing a comma instead of dropping it", () => {
		assert.equal(formatCsvRow(["Lunch, twice"]), '"Lunch, twice"');
	});

	it("doubles embedded quotes", () => {
		assert.equal(formatCsvRow(['He said "hi"']), '"He said ""hi"""');
	});

	it("quotes a field containing a newline", () => {
		assert.equal(formatCsvRow(["two\nlines"]), '"two\nlines"');
	});

	it("emits an empty field for an empty string", () => {
		assert.equal(formatCsvRow(["a", "", "b"]), "a,,b");
	});
});

describe("parseCsv", () => {
	it("splits plain rows on commas", () => {
		assert.deepEqual(parseCsv("a,b,c\n1,2,3"), [
			["a", "b", "c"],
			["1", "2", "3"],
		]);
	});

	it("reads a quoted field containing a comma as one field", () => {
		assert.deepEqual(parseCsv('"Lunch, twice",5'), [["Lunch, twice", "5"]]);
	});

	it("unescapes doubled quotes", () => {
		assert.deepEqual(parseCsv('"He said ""hi""",5'), [['He said "hi"', "5"]]);
	});

	it("keeps a newline inside a quoted field", () => {
		assert.deepEqual(parseCsv('"two\nlines",5'), [["two\nlines", "5"]]);
	});

	it("accepts CRLF line endings", () => {
		assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [
			["a", "b"],
			["1", "2"],
		]);
	});

	it("drops a trailing newline rather than emitting an empty row", () => {
		assert.deepEqual(parseCsv("a,b\n"), [["a", "b"]]);
	});

	it("drops blank lines", () => {
		assert.deepEqual(parseCsv("a,b\n\n1,2"), [
			["a", "b"],
			["1", "2"],
		]);
	});

	it("keeps a row whose every field is empty out of the result", () => {
		assert.deepEqual(parseCsv("a,b\n,\n1,2"), [
			["a", "b"],
			["1", "2"],
		]);
	});

	it("returns no rows for empty input", () => {
		assert.deepEqual(parseCsv(""), []);
	});

	it("strips a UTF-8 byte order mark from the first field", () => {
		assert.deepEqual(parseCsv("﻿Date,Note"), [["Date", "Note"]]);
	});

	it("round-trips every field a formatted row can carry", () => {
		const fields = ['He said "hi"', "Lunch, twice", "two\nlines", "", "plain"];
		assert.deepEqual(parseCsv(formatCsvRow(fields)), [fields]);
	});
});
