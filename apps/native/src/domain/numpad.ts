/**
 * Cents stay exact while `amount * 100` is inside float64's safe integer range
 * (2^53 ≈ 9.0e15), and `amount` is a SQLite `real`. Thirteen digits keeps the
 * largest entry two orders of magnitude clear of that boundary, and is also
 * about where the hero's own type stops shrinking — see `amount-hero-size.ts`.
 */
const MAX_INTEGER_DIGITS = 13;

export const AMOUNT_CEILING = 10 ** MAX_INTEGER_DIGITS;

const LEADING_ZEROS = /^0+/;
const ZERO_FRACTION = /\.0+$/;

export type NumpadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back" | "clear";

/** The keys a keypad draws. `clear` arrives from a long press, not from a tile. */
export type NumpadTileKey = Exclude<NumpadKey, "clear">;

/**
 * `preDotted` shifts every digit through the minor units — 1234 reads as 12.34 —
 * and has no use for a separator key. `explicitSeparator` takes the "." itself.
 */
export type NumpadMode = "preDotted" | "explicitSeparator";

/** Reads Swift's `numberEntryType`: 1 is the pre-dotted keypad, 2 the separator one. */
export function numpadMode(numberEntryType: number): NumpadMode {
    return numberEntryType === 1 ? "preDotted" : "explicitSeparator";
}

/**
 * The entry as a bare minor-unit digit string: at two minor units "12.3" is 1230,
 * so a pre-dotted keystroke is one append and a backspace one slice. An entry
 * seeded from an existing amount therefore shifts from its cents, not from the
 * digits it happens to display.
 */
function toMinorDigits(current: string, minorUnits: number): string {
    const [integer = "", fraction = ""] = current.split(".");
    return `${integer}${fraction.slice(0, minorUnits).padEnd(minorUnits, "0")}`;
}

/** Inverse of `toMinorDigits`. The empty string for digits that read as zero. */
function fromMinorDigits(digits: string, minorUnits: number): string {
    const trimmed = digits.replace(LEADING_ZEROS, "");
    if (trimmed === "") {
        return "";
    }
    // A zero-minor-unit currency has no cents to shift into, so the ladder
    // collapses to plain integer entry rather than inventing a fraction.
    if (minorUnits === 0) {
        return trimmed;
    }
    const padded = trimmed.padStart(minorUnits + 1, "0");
    const cut = padded.length - minorUnits;
    return `${padded.slice(0, cut)}.${padded.slice(cut)}`;
}

function applyPreDottedKey(current: string, key: Exclude<NumpadTileKey, ".">, minorUnits: number): string {
    const digits = toMinorDigits(current, minorUnits);
    const next = key === "back" ? digits.slice(0, -1) : `${digits}${key}`;
    const entry = fromMinorDigits(next, minorUnits);
    const [integer = ""] = entry.split(".");
    return integer.length > MAX_INTEGER_DIGITS ? current : entry;
}

/** The empty string represents an unset amount. */
export function applyNumpadKey(current: string, key: NumpadKey, minorUnits: number, mode: NumpadMode): string {
    if (key === "clear") {
        return "";
    }
    if (mode === "preDotted") {
        return key === "." ? current : applyPreDottedKey(current, key, minorUnits);
    }
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
    return fixed.replace(ZERO_FRACTION, "");
}
