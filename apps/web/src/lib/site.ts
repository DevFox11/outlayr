export const SITE_URL = "https://tryoutlayr.com";
export const APP_STORE_URL = "https://apps.apple.com/app/id6801652978";
export const SUPPORT_EMAIL = "support@tryoutlayr.com";
export const COMPANY = "danestves LLC";

const LEGAL_DAY = new Date(Date.UTC(2026, 8, 24));

export function legalDate(dateLocale: string): string {
    return LEGAL_DAY.toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    });
}
