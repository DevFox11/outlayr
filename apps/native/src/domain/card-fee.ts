import type { Language } from "@/i18n/languages";

import { numberLocale, roundToMinorUnits } from "./money";
import { numpadToNumber } from "./numpad";

export type CardFee =
    | { amount: number; currency: string; kind: "amount" }
    | { kind: "percent"; min?: number; rate: number };

export type FeeDraft =
    | { kind: "none" }
    | { kind: "percent"; rate: number }
    | { kind: "typed"; text: string; unit: "percent" }
    | { currency: string; kind: "typed"; text: string; unit: "amount" };

export const NO_FEE: FeeDraft = { kind: "none" };

export function cardFeeOf(draft: FeeDraft): CardFee | null {
    if (draft.kind === "none") {
        return null;
    }
    if (draft.kind === "percent") {
        return draft.rate > 0 ? { kind: "percent", rate: draft.rate } : null;
    }
    const typed = numpadToNumber(draft.text);
    if (typed <= 0) {
        return null;
    }
    return draft.unit === "percent"
        ? { kind: "percent", rate: typed / 100 }
        : { amount: typed, currency: draft.currency, kind: "amount" };
}

export function cardFeeAmount(fee: CardFee, base: number, currency: string): number {
    return fee.kind === "amount"
        ? roundToMinorUnits(fee.amount, fee.currency)
        : Math.max(roundToMinorUnits(base * fee.rate, currency), fee.min ?? 0);
}

export function cardFeeBase(
    amount: number,
    currencies: { card: string; entry: string },
    toUsd: (amount: number) => number | null,
    cardPerUsd: number | null
): number | null {
    if (amount <= 0) {
        return null;
    }
    if (currencies.card === currencies.entry) {
        return amount;
    }
    const usd = currencies.entry === "USD" ? amount : toUsd(amount);
    if (usd === null) {
        return null;
    }
    if (currencies.card === "USD") {
        return roundToMinorUnits(usd, "USD");
    }
    return cardPerUsd === null ? null : roundToMinorUnits(usd * cardPerUsd, currencies.card);
}

export function formatFeeRate(rate: number, language: Language): string {
    const percent = String(Number((rate * 100).toFixed(2)));
    return `${percent.replace(".", numberLocale(language).decimal)}%`;
}

export function feeDraftOf(fee: { amount: number; currency: string | null; feeRate: number | null } | null): FeeDraft {
    if (fee === null) {
        return NO_FEE;
    }
    return fee.feeRate === null
        ? { currency: fee.currency ?? "USD", kind: "typed", text: String(fee.amount), unit: "amount" }
        : { kind: "percent", rate: fee.feeRate };
}
