import type { Language } from "@/i18n/languages";

export function legalUrl(page: "privacy" | "terms", language: Language): string {
    return language === "en" ? `https://tryoutlayr.com/${page}` : `https://tryoutlayr.com/${language}/${page}`;
}
