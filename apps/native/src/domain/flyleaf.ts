import type { Language } from "@/i18n/languages";

const MONTHS_EN = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

const MONTHS_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
] as const;

/**
 * Hand-rolled per locale: Hermes ships without ICU, so `toLocaleDateString`
 * would silently fall back to en-US for every language.
 */
export function flyleafDate(date: Date, language: Language): string {
    const day = date.getDate();
    const year = date.getFullYear();
    if (language === "es") {
        return `${day} de ${MONTHS_ES[date.getMonth()]} de ${year}`;
    }
    return `${MONTHS_EN[date.getMonth()]} ${day}, ${year}`;
}
