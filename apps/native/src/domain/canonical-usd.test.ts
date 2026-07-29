import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RateLookup } from "@outlayr/money";
import { canonicalUsd } from "./canonical-usd";

/** A lookup over a fixed table, mirroring what the local replica serves. */
function lookupOf(
	rows: Record<string, number>,
	seen?: { calls: number },
): RateLookup {
	return async (quote, _rateType, date) => {
		if (seen) {
			seen.calls += 1;
		}
		const rate = rows[quote];
		return rate === undefined ? null : { rate, date };
	};
}

const DATE = new Date("2026-07-15T12:00:00Z");

describe("canonicalUsd", () => {
	it("divides by the rate, because a rate is currency-per-USD", async () => {
		// 0.92 EUR per USD, so €92 is $100 — not $84.64.
		const result = await canonicalUsd(lookupOf({ EUR: 0.92 }), {
			amount: 92,
			currency: "EUR",
			displayCurrency: "EUR",
			date: DATE,
		});
		assert.equal(result.amountUsd, 100);
		assert.equal(result.exchangeRate, 0.92);
		assert.equal(result.exchangeRateType, "official");
	});

	it("handles a high-inflation quote without losing the cents", async () => {
		const result = await canonicalUsd(lookupOf({ VES: 40 }), {
			amount: 1000,
			currency: "VES",
			displayCurrency: "VES",
			date: DATE,
		});
		assert.equal(result.amountUsd, 25);
	});

	it("treats USD as already canonical and never asks for a rate", async () => {
		const seen = { calls: 0 };
		const result = await canonicalUsd(lookupOf({}, seen), {
			amount: 12.4,
			currency: "USD",
			displayCurrency: "USD",
			date: DATE,
		});
		assert.deepEqual(result, {
			amountUsd: 12.4,
			exchangeRate: 1,
			exchangeRateType: null,
		});
		assert.equal(seen.calls, 0);
	});

	it("falls back to the display currency when the entry names none", async () => {
		const result = await canonicalUsd(lookupOf({ EUR: 0.5 }), {
			amount: 10,
			currency: null,
			displayCurrency: "EUR",
			date: DATE,
		});
		assert.equal(result.amountUsd, 20);
	});

	it("accepts the write with nulls when no rate is cached", async () => {
		// An entry made offline before any rate landed must still be recorded.
		const result = await canonicalUsd(lookupOf({}), {
			amount: 50,
			currency: "GBP",
			displayCurrency: "USD",
			date: DATE,
		});
		assert.deepEqual(result, {
			amountUsd: null,
			exchangeRate: null,
			exchangeRateType: null,
		});
	});

	it("accepts the write when the stored rate is unusable", async () => {
		// A non-positive rate would divide the amount into garbage; the money
		// engine rejects it, and that is a null here rather than a lost entry.
		const result = await canonicalUsd(lookupOf({ EUR: 0 }), {
			amount: 10,
			currency: "EUR",
			displayCurrency: "EUR",
			date: DATE,
		});
		assert.equal(result.amountUsd, null);
	});
});
