import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";

import { formatAmount } from "./money";

/** A balance's display string: "-" only when negative, never a "+". */
export function formatSignedAmount(
    amount: number,
    code: string,
    showCents = true,
    language: Language = runtimeLanguage()
): string {
    const magnitude = formatAmount(Math.abs(amount), code, showCents, language);
    return amount < 0 ? `-${magnitude}` : magnitude;
}
