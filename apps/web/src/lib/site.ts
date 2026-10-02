export const SITE_URL = "https://tryoutlayr.com";
export const APP_STORE_URL = "https://apps.apple.com/app/id6801652978";
export const SUPPORT_EMAIL = "support@tryoutlayr.com";
export const COMPANY = "danestves LLC";

const LEGAL_DAYS = {
    privacy: new Date(Date.UTC(2026, 9, 2)),
    terms: new Date(Date.UTC(2026, 8, 24)),
} as const;

export function legalDate(document: keyof typeof LEGAL_DAYS, dateLocale: string): string {
    return LEGAL_DAYS[document].toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    });
}
