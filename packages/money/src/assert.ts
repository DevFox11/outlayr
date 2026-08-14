import { MoneyValidationError } from "./errors";

const MAX_EPOCH_MS = 8.64e15;

/**
 * Convex's float64 type accepts non-finite values, so every user-supplied
 * number must pass this guard before it is stored or fed into date/rate math.
 */
export function assertFiniteNumber(value: number, label: string): void {
    if (!Number.isFinite(value)) {
        throw new MoneyValidationError(`${label} must be a finite number, got: ${value}`);
    }
}

export function assertOptionalFiniteNumber(value: number | undefined, label: string): void {
    if (value !== undefined) {
        assertFiniteNumber(value, label);
    }
}

/**
 * Epoch milliseconds beyond |8.64e15| are finite — they pass
 * `assertFiniteNumber` — but would make `utcDateString` throw a raw RangeError.
 */
export function assertValidEpochMs(value: number, label: string): void {
    assertFiniteNumber(value, label);
    if (Math.abs(value) > MAX_EPOCH_MS) {
        throw new MoneyValidationError(`${label} must be a valid epoch-milliseconds timestamp, got: ${value}`);
    }
}

export function assertOptionalValidEpochMs(value: number | undefined, label: string): void {
    if (value !== undefined) {
        assertValidEpochMs(value, label);
    }
}
