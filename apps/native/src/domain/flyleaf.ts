import type { Language } from "@/i18n/languages";

import { monthLongTitle } from "./dates";

/**
 * The date as a title page writes it: "July 30, 2026" / "30 de julio de 2026".
 *
 * Hand-rolled rather than `toLocaleDateString`: Hermes ships without ICU, so
 * every language would read back as the en-US default anyway. The month itself
 * comes from the catalog, which is where the app's other twelve month names
 * already live.
 */
export function flyleafDate(date: Date, language: Language): string {
    const day = date.getDate();
    const month = monthLongTitle(date, language);
    const year = date.getFullYear();
    return language === "es" ? `${day} de ${month} de ${year}` : `${month} ${day}, ${year}`;
}
