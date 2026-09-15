import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type CatalogDecimals = 0 | 2 | 3 | 6;

export interface CatalogMeta {
    name: string;
    symbol: string;
}

/**
 * What `overrides.json` may state. `decimals` is separate from `CatalogMeta`
 * because it is not metadata — it changes the arithmetic.
 */
interface CatalogOverride extends Partial<CatalogMeta> {
    decimals?: CatalogDecimals;
}

export interface BuiltCatalog {
    codes: string[];
    decimals: Record<string, CatalogDecimals>;
    meta: Record<string, CatalogMeta>;
}

/**
 * The only fraction-digit counts the money engine, display formatter, and the
 * `CURRENCY_DECIMALS` literal type support. A provider currency outside this set
 * (e.g. a 4-digit accounting unit like CLF) must fail the build loudly rather
 * than ship an exponent the rounding path cannot express.
 *
 * 6 exists for the metals. CLDR has no fraction entry for XAU/XAG/XPT/XPD, so
 * they silently took the DEFAULT of 2 — quantizing gold to 0.01 troy oz, a ~$35
 * step. `$10` of gold rounded to `0`, and `$100` to `0.03 XAU`, which is `$105`
 * back at the same rate. Six matches the engine's own USD_SCALE.
 */
const ALLOWED_DECIMALS = new Set<number>([0, 2, 3, 6]);

function readJson(relativePath: string) {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf-8"));
}

/**
 * Deterministically builds the currency catalog from three committed inputs:
 * the vendored provider code list (Frankfurter USD-base blend + cotizave VES),
 * the pinned CLDR datasets (`cldr-numbers-modern` English names/symbols,
 * `cldr-core` fraction digits), and the manual `overrides.json` overlay. Given
 * the committed inputs it always returns the same `{ codes, decimals, meta }`,
 * so the drift test and the generator agree byte-for-byte on values.
 *
 * Resolution order per field: override wins, then CLDR, then the bare code as a
 * last-resort fallback (matches the runtime bare-code display fallback).
 */
export function buildCatalog(): BuiltCatalog {
    const codes: string[] = readJson("../provider-codes.json");
    const overrides: Record<string, CatalogOverride> = readJson("../overrides.json");
    const cldrCurrencies = require("cldr-numbers-modern/main/en/currencies.json").main.en.numbers.currencies;
    const cldrFractions = require("cldr-core/supplemental/currencyData.json").supplemental.currencyData.fractions;
    const defaultDigits = Number(cldrFractions.DEFAULT._digits);

    const decimals: Record<string, CatalogDecimals> = {};
    const meta: Record<string, CatalogMeta> = {};
    for (const code of codes) {
        const override = overrides[code] ?? {};
        const cldr = cldrCurrencies[code] ?? {};
        // The override first: CLDR carries no fraction digits for a metal, and its
        // DEFAULT is far too coarse for a unit worth thousands of dollars.
        const digits = Number(override.decimals ?? cldrFractions[code]?._digits ?? defaultDigits);
        if (!ALLOWED_DECIMALS.has(digits)) {
            throw new Error(
                `Currency ${code} carries ${digits} fraction digits; only 0, 2, 3 or 6 are supported. Handle the new exponent before regenerating the catalog.`
            );
        }
        decimals[code] = digits as CatalogDecimals;
        meta[code] = {
            name: override.name ?? cldr.displayName ?? code,
            symbol: override.symbol ?? cldr.symbol ?? cldr["symbol-alt-narrow"] ?? code,
        };
    }
    return { codes, decimals, meta };
}
