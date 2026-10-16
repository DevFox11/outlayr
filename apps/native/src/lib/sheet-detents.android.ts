import { StatusBar } from "react-native";

/**
 * Android's answer to `sheet-detents.ts`, same exports.
 *
 * A react-native-screens detent on Android is a fraction of the sheet's
 * maximum height, which is the stack container (the whole window, edge to
 * edge) less the status bar (`SheetDelegate.tryResolveSafeAreaSpaceForSheet`).
 *
 * The resting fractions are iOS's, checked against the Android editors on a
 * Pixel 8-sized phone: the account form fills its sheet, and the category
 * sheets rest about 120dp taller than their fields. Kept as they are: a
 * fraction can't follow content height, and a smaller one would clip the
 * form on shorter phones.
 */
export const CATEGORY_DETENT = 0.65;
export const SUBCATEGORY_DETENT = 0.55;
export const ACCOUNT_DETENT = 0.72;

/**
 * The Android identity picker's resting height. Taller than iOS's 430: its
 * sheet header, segmented buttons, search field and swatch rail come to about
 * 270dp, and the glyph grid needs room for four rows under them. There is no
 * fly-up on Android, so nothing has to stay visible above it.
 */
const PICKER_HEIGHT = 560;
/** What a full-height sheet leaves above itself on Android: the status bar. */
export const LARGE_SHEET_TOP_INSET = StatusBar.currentHeight ?? 0;

export function identityPickerDetent(windowHeight: number): number {
    return heightDetent(PICKER_HEIGHT, windowHeight);
}

export function heightDetent(height: number, windowHeight: number): number {
    const maxDetent = Math.max(1, windowHeight - LARGE_SHEET_TOP_INSET);
    return Math.min(1, height / maxDetent);
}

/**
 * Kept for the shared callers' types, but don't switch a live sheet to it on
 * Android: the native sheet keeps the detents it was created with, and once one
 * is declared where it has two, a swipe down to the lower one crashes
 * react-native-screens ("Invalid state 4 for detentCount 1"). Keep the count.
 */
export const LARGE_ONLY = [1];
