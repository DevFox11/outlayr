import { calculator, halfEven } from "dinero.js/bigint";

import { MoneyValidationError } from "./errors";

export const DECIMAL_RADIX = 10n;

/**
 * Canonical USD is stored at scale 6 (micro-dollars); six places carry every
 * realistic rate division with sub-cent precision.
 *
 * Exactness ceiling: the micro-dollar integer is returned to JS as a `number`,
 * so it is exact only up to `Number.MAX_SAFE_INTEGER` (2^53 - 1) micro-dollars
 * ≈ $9,007,199,254.74 (~$9.007B). A magnitude above that loses sub-micro
 * precision without ever becoming non-finite, so the overflow guard does not
 * reject it. True overflow (e.g. a sub-normal rate) still produces a non-finite
 * number and is rejected.
 */
export const USD_SCALE = 6n;

export interface ScaledInt {
    amount: bigint;
    scale: bigint;
}

/**
 * Reads the number's shortest round-trip decimal string, which is spec-defined
 * and therefore identical on V8 and Hermes.
 */
export function toScaledInt(value: number): ScaledInt {
    if (!Number.isFinite(value)) {
        throw new MoneyValidationError(`Cannot represent a non-finite number as a scaled integer: ${value}`);
    }
    // `Number.prototype.toString` only ever emits a lowercase `e` exponent.
    const [mantissa = "0", exponentPart] = value.toString().split("e");
    const exponent = exponentPart ? Number.parseInt(exponentPart, 10) : 0;
    const negative = mantissa.startsWith("-");
    const unsigned = negative ? mantissa.slice(1) : mantissa;
    const [integerDigits = "", fractionDigits = ""] = unsigned.split(".");
    const digits = `${integerDigits}${fractionDigits}`;
    let amount = BigInt(digits === "" ? "0" : digits);
    let scale = fractionDigits.length - exponent;
    if (scale < 0) {
        amount *= DECIMAL_RADIX ** BigInt(-scale);
        scale = 0;
    }
    return { amount: negative ? -amount : amount, scale: BigInt(scale) };
}

/**
 * Dinero multiplies but does not divide by an arbitrary rate, so a conversion
 * is expressed as ONE exact rational and rounded once here instead of inverting
 * the rate first (which `convert()` would require).
 */
export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
    return halfEven(numerator, denominator, calculator);
}
