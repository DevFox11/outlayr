import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyNumpadKey,
	type NumpadKey,
	numberToNumpad,
	numpadToNumber,
} from "./numpad";

function type(keys: string, minorUnits = 2, from = ""): string {
	return [...keys].reduce(
		(acc, key) => applyNumpadKey(acc, key as NumpadKey, minorUnits),
		from,
	);
}

describe("applyNumpadKey digits", () => {
	it("accumulates digits left to right", () => {
		assert.equal(type("1234"), "1234");
	});

	it("replaces a lone zero instead of prefixing it", () => {
		assert.equal(type("05"), "5");
	});

	it("keeps zeros that follow a real digit", () => {
		assert.equal(type("100"), "100");
	});

	it("caps the integer part at nine digits", () => {
		assert.equal(type("1234567890"), "123456789");
	});
});

describe("applyNumpadKey separator", () => {
	it("admits one separator and refuses a second", () => {
		assert.equal(type("1.5.5"), "1.55");
	});

	it("seeds a leading zero when the separator opens the entry", () => {
		assert.equal(type("."), "0.");
	});

	it("refuses the separator entirely on a zero-minor-unit currency", () => {
		assert.equal(type("1.5", 0), "15");
	});

	it("caps the fraction at the currency's minor units", () => {
		assert.equal(type("1.239", 2), "1.23");
		assert.equal(type("1.2394", 3), "1.239");
	});
});

describe("applyNumpadKey backspace", () => {
	it("peels one character at a time", () => {
		assert.equal(applyNumpadKey("1.23", "back", 2), "1.2");
	});

	it("removes the separator like any other character", () => {
		assert.equal(applyNumpadKey("1.", "back", 2), "1");
	});

	it("is a no-op on an empty entry rather than throwing", () => {
		assert.equal(applyNumpadKey("", "back", 2), "");
	});

	it("re-admits the separator once it has been peeled off", () => {
		const peeled = applyNumpadKey("0.", "back", 2);
		assert.equal(peeled, "0");
		assert.equal(applyNumpadKey(peeled, ".", 2), "0.");
	});
});

describe("numpadToNumber", () => {
	it("reads a complete entry", () => {
		assert.equal(numpadToNumber("12.34"), 12.34);
	});

	it("treats an unset or bare-separator entry as zero", () => {
		assert.equal(numpadToNumber(""), 0);
		assert.equal(numpadToNumber("."), 0);
	});

	it("reads a trailing separator as the integer so far", () => {
		assert.equal(numpadToNumber("12."), 12);
	});

	it("falls back to zero on anything unparseable", () => {
		assert.equal(numpadToNumber("abc"), 0);
	});
});

describe("numberToNumpad", () => {
	it("returns an unset entry for zero and negatives", () => {
		assert.equal(numberToNumpad(0, 2), "");
		assert.equal(numberToNumpad(-5, 2), "");
	});

	it("drops a pure zero fraction so the entry reads like an integer", () => {
		assert.equal(numberToNumpad(12, 2), "12");
	});

	it("keeps a meaningful fraction", () => {
		assert.equal(numberToNumpad(12.34, 2), "12.34");
	});

	it("rounds to the currency's minor units", () => {
		assert.equal(numberToNumpad(12.567, 2), "12.57");
		assert.equal(numberToNumpad(12.5, 0), "13");
	});

	it("round-trips through numpadToNumber", () => {
		for (const [amount, minorUnits] of [
			[12.34, 2],
			[7, 2],
			[0.05, 2],
			[1234, 0],
			[9.999, 3],
		] as const) {
			assert.equal(
				numpadToNumber(numberToNumpad(amount, minorUnits)),
				Number(amount.toFixed(minorUnits)),
				`${amount} at ${minorUnits} minor units did not survive the round trip`,
			);
		}
	});
});
