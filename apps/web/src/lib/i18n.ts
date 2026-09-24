import { defaultLocale, getLocalizedUrl, isDeclaredLocale, validatePrefix } from "intlayer";
import type { DeclaredLocales } from "intlayer";

import { SITE_URL } from "./site";

export type Locale = DeclaredLocales;

export const LANGUAGES = {
    en: { date: "en-GB", hreflang: "en", lang: "en", name: "English", og: "en_US" },
    es: { date: "es-419", hreflang: "es", lang: "es-419", name: "Español", og: "es_LA" },
} as const satisfies Record<Locale, { date: string; hreflang: string; lang: string; name: string; og: string }>;

export function localeFromParam(param: string | undefined): Locale {
    const { localePrefix } = validatePrefix(param);
    return isDeclaredLocale(localePrefix) ? localePrefix : defaultLocale;
}

export function pageUrl(path: string, locale: Locale): string {
    return `${SITE_URL}${getLocalizedUrl(path, locale)}`;
}
