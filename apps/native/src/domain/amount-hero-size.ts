export const AMOUNT_HERO_MAX_SIZE = 62;
export const AMOUNT_HERO_MIN_SIZE = 26;

/**
 * Mean advance of a grouped figure in SF Pro Rounded Semibold, as a fraction of
 * the point size — digits run ~0.60em and the separators ~0.28em, so this is the
 * blend measured across `1,234.56`-shaped strings. Only an estimate is possible
 * here: NumberFlow draws its own digit views, so nothing reports a text width
 * back before layout.
 */
const ADVANCE_PER_CHAR = 0.58;

/** Room the currency symbol and its gap take out of the line. */
export const SYMBOL_ALLOWANCE = 26;

/** Characters a figure renders as, including group separators and the decimal. */
export function amountHeroLength(amount: number, minorUnits: number): number {
    const whole = Math.floor(Math.abs(amount));
    const integerDigits = whole.toString().length;
    const separators = Math.floor((integerDigits - 1) / 3);
    const fraction = minorUnits > 0 ? minorUnits + 1 : 0;
    return integerDigits + separators + fraction;
}

/**
 * Point size that keeps the figure inside `contentWidth`. The SwiftUI Text this
 * replaced shrank itself through `minimumScaleFactor`; a NumberFlow has a fixed
 * size, so without this a nine-figure amount runs off both edges.
 */
export function amountHeroFontSize(amount: number, minorUnits: number, contentWidth: number): number {
    const available = contentWidth - SYMBOL_ALLOWANCE;
    if (available <= 0) {
        return AMOUNT_HERO_MIN_SIZE;
    }
    const fits = available / (amountHeroLength(amount, minorUnits) * ADVANCE_PER_CHAR);
    return Math.max(AMOUNT_HERO_MIN_SIZE, Math.min(AMOUNT_HERO_MAX_SIZE, fits));
}
