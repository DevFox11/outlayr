export const SITE_URL = "https://tryoutlayr.com";
export const APP_STORE_URL = "https://apps.apple.com/app/id6801652978";
export const SUPPORT_EMAIL = "support@tryoutlayr.com";
export const COMPANY = "danestves LLC";

export const RIVALS_CHECKED = new Date(Date.UTC(2026, 9, 7));

export const LEGAL_DAYS = {
    privacy: new Date(Date.UTC(2026, 9, 3)),
    terms: new Date(Date.UTC(2026, 9, 3)),
} as const;

export function legalDate(document: keyof typeof LEGAL_DAYS, dateLocale: string): string {
    return longDate(LEGAL_DAYS[document], dateLocale);
}

export function longDate(day: Date, dateLocale: string): string {
    return day.toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    });
}
