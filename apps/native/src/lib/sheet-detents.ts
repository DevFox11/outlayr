/**
 * How tall the category sheets open, as react-native-screens detent fractions.
 *
 * A fraction here is of the sheet's own MAXIMUM height (the screen less the inset
 * a large sheet leaves at the top), not of the screen — passing 0.5 for "half"
 * lands ~40pt short of SwiftUI's `.medium`. These are the heights the sheets are
 * meant to open at: a subcategory has no Type row, so it needs less.
 */
export const CATEGORY_DETENT = 0.65;
export const SUBCATEGORY_DETENT = 0.55;
/** The account editor carries a currency and balance row the category sheet lacks. */
export const ACCOUNT_DETENT = 0.72;
/** The installment pay sheet: an amount, its conversion and three rows. */
export const INSTALLMENT_PAY_DETENT = 0.62;

/** Swift `IdentityHero.pickerHeight`: both identity pickers are a fixed 430pt sheet. */
const PICKER_HEIGHT = 430;
/**
 * The gap a full-height sheet leaves above itself — what a detent fraction is
 * actually measured against. Measured on an iPhone 17 Pro: a 0.5 fraction gave a
 * 423pt sheet on an 874pt window, so the maximum is ~836.
 */
export const LARGE_SHEET_TOP_INSET = 38;

/**
 * Swift pins the identity picker to a HEIGHT; react-native-screens only takes
 * fractions, so the same sheet needs a different fraction on every screen size.
 * Without this the picker is ~12pt short on a 6.3" phone and ~29pt too tall on a
 * 6.9" one — and the hero floats to the middle of whatever space is left, so the
 * error lands on the animation, not just the sheet.
 */
export function identityPickerDetent(windowHeight: number): number {
    return heightDetent(PICKER_HEIGHT, windowHeight);
}

export function heightDetent(height: number, windowHeight: number): number {
    const maxDetent = Math.max(1, windowHeight - LARGE_SHEET_TOP_INSET);
    return Math.min(1, height / maxDetent);
}

/**
 * What a sheet hosting the identity hero allows while its picker is open.
 *
 * Swift grows the parent to `.large` before presenting the picker — "the nested
 * picker is 430pt tall; from the medium detent it would cover the whole parent"
 * (`NewCategoryAlert.openPicker`) — and leaves it there afterwards. UIKit applies
 * a sheet's selected detent only once, so the way to move it later is to
 * re-declare which detents exist at all.
 */
export const LARGE_ONLY = [1];
