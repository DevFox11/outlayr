import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyNumpadKey,
	type NumpadKey,
	type NumpadMode,
	numberToNumpad,
	numpadMode,
	numpadToNumber,
} from "./numpad";

function type(
	keys: string,
	minorUnits = 2,
	from = "",
	mode: NumpadMode = "explicitSeparator",
): string {
	return [...keys].reduce(
		(acc, key) => applyNumpadKey(acc, key as NumpadKey, minorUnits, mode),
		from,
	);
}

function preDotted(keys: string, minorUnits = 2, from = ""): string {
	return type(keys, minorUnits, from, "preDotted");
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
		assert.equal(applyNumpadKey("1.23", "back", 2, "explicitSeparator"), "1.2");
	});

	it("removes the separator like any other character", () => {
		assert.equal(applyNumpadKey("1.", "back", 2, "explicitSeparator"), "1");
	});

	it("is a no-op on an empty entry rather than throwing", () => {
		assert.equal(applyNumpadKey("", "back", 2, "explicitSeparator"), "");
	});

	it("re-admits the separator once it has been peeled off", () => {
		const peeled = applyNumpadKey("0.", "back", 2, "explicitSeparator");
		assert.equal(peeled, "0");
		assert.equal(applyNumpadKey(peeled, ".", 2, "explicitSeparator"), "0.");
	});
});

describe("numpadMode", () => {
	it("maps the stored setting onto the keypad's behaviour", () => {
		assert.equal(numpadMode(1), "preDotted");
		assert.equal(numpadMode(2), "explicitSeparator");
	});

	it("reads an unrecognised stored value as the separator keypad", () => {
		assert.equal(numpadMode(0), "explicitSeparator");
		assert.equal(numpadMode(7), "explicitSeparator");
	});
});

describe("applyNumpadKey pre-dotted", () => {
	it("shifts each digit through the minor units", () => {
		assert.equal(preDotted("1"), "0.01");
		assert.equal(preDotted("12"), "0.12");
		assert.equal(preDotted("123"), "1.23");
		assert.equal(preDotted("1234"), "12.34");
	});

	it("walks back down the same ladder on backspace", () => {
		const back = (from: string) => applyNumpadKey(from, "back", 2, "preDotted");
		const three = back("12.34");
		assert.equal(three, "1.23");
		const two = back(three);
		assert.equal(two, "0.12");
		const one = back(two);
		assert.equal(one, "0.01");
		assert.equal(back(one), "");
		assert.equal(back(""), "");
	});

	it("ignores the separator key, which has nothing left to say", () => {
		assert.equal(applyNumpadKey("1.23", ".", 2, "preDotted"), "1.23");
		assert.equal(preDotted("1.2"), "0.12");
	});

	it("shifts into three minor units just as readily as two", () => {
		assert.equal(preDotted("1234", 3), "1.234");
		assert.equal(applyNumpadKey("1.234", "back", 3, "preDotted"), "0.123");
	});

	it("leaves a zero-minor-unit currency on whole numbers", () => {
		assert.equal(preDotted("1234", 0), "1234");
		assert.equal(applyNumpadKey("123", "back", 0, "preDotted"), "12");
		assert.equal(applyNumpadKey("12", ".", 0, "preDotted"), "12");
	});

	it("never lets a leading zero become part of the amount", () => {
		assert.equal(preDotted("000"), "");
		assert.equal(preDotted("0005"), "0.05");
	});

	it("shifts an entry seeded from an existing amount out of its cents", () => {
		assert.equal(applyNumpadKey("12", "5", 2, "preDotted"), "120.05");
		assert.equal(applyNumpadKey("12.34", "5", 2, "preDotted"), "123.45");
	});

	it("caps the integer part at nine digits", () => {
		assert.equal(preDotted("123456789012"), "123456789.01");
	});

	it("reads back as the amount it displays", () => {
		assert.equal(numpadToNumber(preDotted("1")), 0.01);
		assert.equal(numpadToNumber(preDotted("1234")), 12.34);
		assert.equal(numpadToNumber(preDotted("1234", 0)), 1234);
	});
});

describe("applyNumpadKey clear", () => {
	it("wipes the whole entry in either mode", () => {
		assert.equal(applyNumpadKey("12.34", "clear", 2, "explicitSeparator"), "");
		assert.equal(applyNumpadKey("12.34", "clear", 2, "preDotted"), "");
	});

	it("is idempotent on an entry that is already unset", () => {
		const cleared = applyNumpadKey("9", "clear", 2, "explicitSeparator");
		assert.equal(cleared, "");
		assert.equal(applyNumpadKey(cleared, "clear", 2, "explicitSeparator"), "");
		assert.equal(applyNumpadKey(cleared, "clear", 0, "preDotted"), "");
	});

	it("leaves the entry typeable from scratch", () => {
		const cleared = applyNumpadKey("12.34", "clear", 2, "preDotted");
		assert.equal(applyNumpadKey(cleared, "7", 2, "preDotted"), "0.07");
		assert.equal(applyNumpadKey(cleared, "7", 2, "explicitSeparator"), "7");
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
