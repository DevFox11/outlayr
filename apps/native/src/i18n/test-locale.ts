import type { Locale } from "expo-localization";

/**
 * A complete {@link Locale} for a `getLocales()` mock, with `overrides` applied
 * over a US English device.
 *
 * Test-only. `getLocales` is a native read with fourteen members, and a suite
 * asserting on one of them — the region code, the language tag — was declaring
 * an object with just that member, which does not satisfy the return type. Name
 * the member under test as an override and leave the rest alone.
 */
export const testLocale = (overrides: Partial<Locale> = {}): Locale => ({
    currencyCode: "USD",
    currencySymbol: "$",
    decimalSeparator: ".",
    digitGroupingSeparator: ",",
    languageCode: "en",
    languageCurrencyCode: "USD",
    languageCurrencySymbol: "$",
    languageRegionCode: "US",
    languageScriptCode: null,
    languageTag: "en-US",
    measurementSystem: "us",
    regionCode: "US",
    temperatureUnit: "fahrenheit",
    textDirection: "ltr",
    ...overrides,
});
