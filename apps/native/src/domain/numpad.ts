const MAX_INTEGER_DIGITS = 9; // integer cap 100_000_000 → at most 9 digits.

export type NumpadKey =
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "."
	| "back";

/** The empty string represents an unset amount. */
export function applyNumpadKey(
	current: string,
	key: NumpadKey,
	minorUnits: number,
): string {
	if (key === "back") {
		return current.slice(0, -1);
	}
	if (key === ".") {
		if (minorUnits === 0 || current.includes(".")) {
			return current;
		}
		return current === "" ? "0." : `${current}.`;
	}
	const [integer = "", fraction = ""] = current.split(".");
	const hasDot = current.includes(".");
	if (hasDot) {
		if (fraction.length >= minorUnits) {
			return current;
		}
		return `${current}${key}`;
	}
	// Leading-zero guard: a lone "0" is replaced, not prefixed.
	const nextInteger = integer === "0" ? key : `${integer}${key}`;
	if (nextInteger.length > MAX_INTEGER_DIGITS) {
		return current;
	}
	return nextInteger;
}

export function numpadToNumber(value: string): number {
	if (value === "" || value === ".") {
		return 0;
	}
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function numberToNumpad(amount: number, minorUnits: number): string {
	if (amount <= 0) {
		return "";
	}
	const fixed = amount.toFixed(minorUnits);
	// Drop a pure ".00" tail so the entry reads like a fresh integer.
	return fixed.replace(/\.0+$/, "");
}
