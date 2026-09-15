import { dinero, halfEven, toDecimal, transformScale, USD } from "dinero.js/bigint";

import { assertFiniteNumber } from "./assert";
import { DEFAULT_MONEY_DECIMALS, decimalsFor } from "./currency";
import { toScaledInt } from "./scaled-int";

/**
 * Half-to-even rounding of the value's exact decimal, not of its binary double:
 * `2.675 -> 2.68`. Display/aggregation only — canonical USD is stored unrounded,
 * so totals must be summed at full precision and rounded once on the sum.
 */
export function roundMoney(value: number, decimals: number = DEFAULT_MONEY_DECIMALS): number {
    if (!Number.isFinite(value)) {
        throw new TypeError(`roundMoney received a non-finite value: ${value}`);
    }
    const { amount, scale } = toScaledInt(value);
    const money = dinero({ amount, currency: USD, scale });
    const rounded = transformScale(money, BigInt(decimals), halfEven);
    return Number(toDecimal(rounded));
}

/**
 * USD to USD returns the amount unchanged: an exact identity that skips the
 * rounding pass and so preserves the canonical value's sub-cent precision.
 *
 * Keyed on the code and not on `rate === 1`, because a rate of exactly one is
 * not the same claim. BSD, PAB and BMD are hard USD pegs a `base=USD` feed
 * quotes at 1.0, and they still owe their own exponent — as would any code a
 * provider happened to return 1.0 for, including a zero-decimal one.
 */
export function convertFromUsd(amountUsd: number, rate: number, code: string): number {
    assertFiniteNumber(amountUsd, "amountUsd");
    assertFiniteNumber(rate, "rate");
    if (rate === 1 && code === "USD") {
        return amountUsd;
    }
    const amount = toScaledInt(amountUsd);
    const scaledRate = toScaledInt(rate);
    const product = dinero({
        amount: amount.amount * scaledRate.amount,
        currency: USD,
        scale: amount.scale + scaledRate.scale,
    });
    const rounded = transformScale(product, BigInt(decimalsFor(code)), halfEven);
    return Number(toDecimal(rounded));
}
