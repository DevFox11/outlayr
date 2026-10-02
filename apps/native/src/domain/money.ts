import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";
import { currencyDisplayFor, decimalsFor } from "@outlayr/money/currency";
import { roundMoney } from "@outlayr/money/round";
import type { Locale } from "expo-localization";

import { firstLocale } from "@/i18n/device-language";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";

export const DEFAULT_CURRENCY = "USD";

export interface NumberLocale {
    decimal: string;
    group: string;
    /**
     * BCP-47 tag for the few APIs that insist on `Intl` — `NumberFlow` builds its
     * digit slots from `formatToParts`. The separators below must mirror what this
     * tag produces, or an animated figure disagrees with a static one beside it.
     */
    tag: string;
}

const ENGLISH: NumberLocale = { decimal: ".", group: ",", tag: "en-US" };

type DeviceNumbers = Pick<Locale, "decimalSeparator" | "digitGroupingSeparator" | "regionCode">;

export function latinAmericanLocale(device: DeviceNumbers | null): NumberLocale {
    return {
        decimal: device?.decimalSeparator ?? ".",
        group: device?.digitGroupingSeparator ?? ",",
        tag: device?.regionCode ? `es-${device.regionCode}` : "es-419",
    };
}

// ponytail: read once per launch; a region changed mid-session shows after a relaunch.
let spanish: NumberLocale | undefined;

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

function splitFixed(fixed: string, locale: NumberLocale) {
    const [integer = "0", fraction = ""] = fixed.split(".");
    return { fraction, integer: integer.replaceAll(THOUSANDS, locale.group) };
}

export function formatFixed(value: number, decimals: number, language: Language = runtimeLanguage()): string {
    const locale = numberLocale(language);
    const fixed = Math.abs(value).toFixed(decimals);
    const { fraction, integer } = splitFixed(fixed, locale);
    const sign = value < 0 && Number(fixed) > 0 ? "-" : "";
    return `${sign}${fraction === "" ? integer : `${integer}${locale.decimal}${fraction}`}`;
}

export function numberLocale(language: Language = runtimeLanguage()): NumberLocale {
    if (language === "en") {
        return ENGLISH;
    }
    spanish ??= latinAmericanLocale(firstLocale());
    return spanish;
}

export { decimalsFor as minorUnitsFor } from "@outlayr/money/currency";

export function currencySymbol(code: string): string {
    return currencyDisplayFor(code).symbol;
}

const SHARED_SYMBOLS: ReadonlySet<string> = new Set(
    PICKABLE_CURRENCY_CODES.map((code) => CURRENCY_META[code].symbol).filter(
        (symbol, index, symbols) => symbols.indexOf(symbol) !== index
    )
);

export function symbolIsShared(code: string): boolean {
    return SHARED_SYMBOLS.has(currencySymbol(code));
}

/** Exact half-even rounding to whatever precision the code actually stores. */
export function roundToMinorUnits(amount: number, code: string): number {
    return roundMoney(amount, decimalsFor(code));
}

export interface AmountParts {
    /** Zero-padded fraction of `minorUnits` length, or "" when the code has none. */
    fraction: string;
    /** Integer portion grouped with `locale.group`, e.g. "1,240" or "1.240". */
    integer: string;
    locale: NumberLocale;
    minorUnits: number;
    symbol: string;
}

/**
 * Splits a positive magnitude into display parts for a currency code. Grouping
 * and the decimal mark come from the language (and for Spanish, the region),
 * not from `Intl` — Hermes lacks full ICU, so `Intl.NumberFormat` is avoided
 * here the same way `translate.ts` avoids `Intl.PluralRules`. The magnitude is
 * rounded to the code's minor units via `@outlayr/money`'s exact half-even
 * `roundMoney`.
 *
 * `showCents` mirrors the Swift "Display Cents" setting: when false the value is
 * rounded to whole units and no fraction is emitted.
 */
export function amountParts(
    amount: number,
    code: string,
    showCents = true,
    language: Language = runtimeLanguage()
): AmountParts {
    const locale = numberLocale(language);
    const minorUnits = showCents ? decimalsFor(code) : 0;
    const rounded = roundMoney(Math.abs(amount), minorUnits);
    const { fraction, integer } = splitFixed(rounded.toFixed(minorUnits), locale);
    return {
        fraction: minorUnits > 0 ? fraction : "",
        integer,
        locale,
        minorUnits,
        symbol: currencySymbol(code),
    };
}

/** The figure alone: grouped integer joined to its fraction by the decimal mark. */
export function amountDigits(parts: AmountParts): string {
    return parts.fraction ? `${parts.integer}${parts.locale.decimal}${parts.fraction}` : parts.integer;
}

export const AMOUNT_MASK = "••••";

export function maskedAmount(code: string): string {
    return `${currencySymbol(code)}${AMOUNT_MASK}`;
}

/** Wraps already-built digits in the symbol. */
export function withCurrencySymbol(parts: AmountParts, digits: string): string {
    return `${parts.symbol}${digits}`;
}

/**
 * Unsigned display string for a magnitude, e.g. "$1,240.00" in English and
 * "$1.240,00" in Spanish on an Argentine device (or "¥1,240" with no minor units).
 */
export function formatAmount(
    amount: number,
    code: string,
    showCents = true,
    language: Language = runtimeLanguage()
): string {
    const parts = amountParts(amount, code, showCents, language);
    return withCurrencySymbol(parts, amountDigits(parts));
}
