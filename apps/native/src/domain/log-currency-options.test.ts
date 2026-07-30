import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logCurrencyOptions } from "./log-currency-options";

describe("logCurrencyOptions", () => {
	it("offers the ledger's currency alone on a single-currency ledger", () => {
		// This is what "the chip always shows" rests on: one option, still an
		// option, so the chip has something to render and stays tappable.
		assert.deepEqual(
			logCurrencyOptions({ global: "USD", favourites: [], produced: ["USD"] }),
			["USD"],
		);
	});

	it("offers the ledger's currency even when the period produced nothing", () => {
		assert.deepEqual(
			logCurrencyOptions({ global: "USD", favourites: [], produced: [] }),
			["USD"],
		);
	});

	it("leads with the ledger's currency whatever the period produced", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: [],
				produced: ["JPY", "EUR", "USD"],
			}),
			["USD", "JPY", "EUR"],
		);
	});

	it("leads with the ledger's currency even when a favourite repeats it", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["EUR", "USD", "JPY"],
				produced: [],
			}),
			["USD", "EUR", "JPY"],
		);
	});

	it("keeps favourites in the order they were arranged, not sorted", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["JPY", "EUR", "AUD"],
				produced: [],
			}),
			["USD", "JPY", "EUR", "AUD"],
		);
	});

	it("appends a produced currency that is not already offered", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["EUR"],
				produced: ["VES"],
			}),
			["USD", "EUR", "VES"],
		);
	});

	it("appends produced currencies after every favourite, in their own order", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["EUR", "JPY"],
				produced: ["VES", "COP"],
			}),
			["USD", "EUR", "JPY", "VES", "COP"],
		);
	});

	it("collapses a produced currency that is already a favourite", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["EUR", "JPY"],
				produced: ["JPY", "USD", "EUR"],
			}),
			["USD", "EUR", "JPY"],
		);
	});

	it("collapses repeats inside one list", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["EUR", "EUR"],
				produced: ["VES", "VES"],
			}),
			["USD", "EUR", "VES"],
		);
	});

	it("collapses codes that differ only in case, keeping the first spelling", () => {
		// The kept spelling is the data's own: it is what a rate lookup and a
		// bucket label are matched against, so it must not be rewritten.
		assert.deepEqual(
			logCurrencyOptions({
				global: "usd",
				favourites: ["USD", "eur"],
				produced: ["EUR"],
			}),
			["usd", "eur"],
		);
	});

	it("drops empty and whitespace-only codes rather than offering a blank", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: ["", " "],
				produced: ["\t", "EUR"],
			}),
			["USD", "EUR"],
		);
	});

	it("trims the padding a hand-edited stored list would carry", () => {
		assert.deepEqual(
			logCurrencyOptions({
				global: "USD",
				favourites: [" EUR "],
				produced: ["EUR", " JPY"],
			}),
			["USD", "EUR", "JPY"],
		);
	});

	it("offers a produced code the currency catalogue does not know", () => {
		// Dropping it would leave the one figure on screen unreadable: the user
		// could see the bucket and never switch the screen into it.
		assert.deepEqual(
			logCurrencyOptions({ global: "USD", favourites: [], produced: ["XXX"] }),
			["USD", "XXX"],
		);
	});

	it("never mutates the lists it is handed", () => {
		const favourites = ["EUR"];
		const produced = ["JPY"];
		logCurrencyOptions({ global: "USD", favourites, produced });
		assert.deepEqual(favourites, ["EUR"]);
		assert.deepEqual(produced, ["JPY"]);
	});

	describe("when a favourite cannot be reached", () => {
		const reaches =
			(...codes: string[]) =>
			(code: string) =>
				codes.includes(code);

		it("drops a favourite no rate can express a figure in", () => {
			// Offering it would put a code on the chip that the numbers beside it can
			// never be in — the screen would name CHF and print EUR.
			assert.deepEqual(
				logCurrencyOptions({
					global: "EUR",
					favourites: ["CHF", "JPY"],
					produced: [],
					convertible: reaches("JPY"),
				}),
				["EUR", "JPY"],
			);
		});

		it("keeps the ledger's own currency even when nothing can reach it", () => {
			// It is the only way out of an override, so dropping it would trap the
			// screen in whatever it was last switched to.
			assert.deepEqual(
				logCurrencyOptions({
					global: "VES",
					favourites: [],
					produced: [],
					convertible: () => false,
				}),
				["VES"],
			);
		});

		it("keeps a produced code even when nothing can reach it", () => {
			assert.deepEqual(
				logCurrencyOptions({
					global: "USD",
					favourites: [],
					produced: ["VES"],
					convertible: () => false,
				}),
				["USD", "VES"],
			);
		});

		it("tests the trimmed code, not the stored spelling", () => {
			assert.deepEqual(
				logCurrencyOptions({
					global: "USD",
					favourites: [" EUR "],
					produced: [],
					convertible: reaches("EUR"),
				}),
				["USD", "EUR"],
			);
		});

		it("offers every favourite when no predicate is given", () => {
			assert.deepEqual(
				logCurrencyOptions({
					global: "USD",
					favourites: ["CHF"],
					produced: [],
				}),
				["USD", "CHF"],
			);
		});
	});
});
