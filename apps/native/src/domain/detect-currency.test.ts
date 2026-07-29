import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectCurrency } from "./detect-currency";

describe("detectCurrency", () => {
	it("reads an unambiguous symbol", () => {
		assert.equal(detectCurrency("€12,40"), "EUR");
		assert.equal(detectCurrency("¥1,240"), "JPY");
		assert.equal(detectCurrency("₹250"), "INR");
	});

	it("prefers an explicit ISO code, which cannot be ambiguous", () => {
		assert.equal(detectCurrency("12.40 EUR"), "EUR");
		assert.equal(detectCurrency("CAD 25.00"), "CAD");
		assert.equal(detectCurrency("USD 8"), "USD");
	});

	it("declines a shared symbol rather than guessing a country", () => {
		// The catalog has "$" on 22 currencies and "£" on 9.
		assert.equal(detectCurrency("$12.40"), null);
		assert.equal(detectCurrency("£5.00"), null);
		assert.equal(detectCurrency("kr 99"), null);
	});

	it("declines when there is nothing to go on", () => {
		assert.equal(detectCurrency("12.40"), null);
		assert.equal(detectCurrency(""), null);
		assert.equal(detectCurrency(null), null);
		assert.equal(detectCurrency(undefined), null);
	});

	it("survives the spacing and signs a formatter emits", () => {
		assert.equal(detectCurrency("  €  1.234,56  "), "EUR");
		assert.equal(detectCurrency("-€12,40"), "EUR");
		// A non-breaking space is what most locales actually put between the
		// number and its symbol.
		assert.equal(detectCurrency("1 234,56 €"), "EUR");
	});
});
