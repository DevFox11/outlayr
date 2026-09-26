import { formatSignedAmount } from "@/domain/account-display";
import { formatAmount } from "@/domain/money";
import { formatEnteredRate, formatRateFigure, quotePairRate } from "@/domain/transaction-entry-rate";
import type { useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

import type { useTransferDraft } from "./use-transfer-draft";

export interface TransferGapPrompt {
    feeLabel: string | null;
    message: string;
    onFee: (() => void) | null;
    onRate: (() => void) | null;
    rateLabel: string | null;
}

type Draft = ReturnType<typeof useTransferDraft>;
type Translate = ReturnType<typeof useTranslation>;

export function formatRate(
    draft: Pick<Draft, "fromCurrency" | "toCurrency">,
    rate: number | null,
    language: Language
): string | null {
    return rate === null ? null : formatRateFigure(quotePairRate(draft.fromCurrency, draft.toCurrency, rate), language);
}

function offeredRateText(draft: Pick<Draft, "fromCurrency" | "toCurrency">, rate: number, language: Language): string {
    return formatEnteredRate(quotePairRate(draft.fromCurrency, draft.toCurrency, rate), language);
}

export function blockMessage(draft: Draft, t: Translate, language: Language): string {
    if (draft.block === null || draft.block.kind === "rate") {
        return t("transfers.rate.unavailable");
    }
    return draft.block.shortfall > 0
        ? t("transfers.block.feeOverArrival", {
              amount: formatAmount(draft.block.shortfall, draft.feeCurrency, true, language),
          })
        : t("transfers.block.nothingArrives");
}

/** No resolution to offer: no fee or rate the screen could invent gives a blocked
 * transfer legs, so the prompt only names what does not add up. */
export function blockPrompt(draft: Draft, t: Translate, language: Language): TransferGapPrompt | null {
    if (draft.block === null) {
        return null;
    }
    return {
        feeLabel: null,
        message: blockMessage(draft, t, language),
        onFee: null,
        onRate: null,
        rateLabel: null,
    };
}

/** Only offers a resolution that would actually move the gap: a negative one is no
 * fee, and a rate the transfer already carries changes nothing. */
export function gapPrompt(draft: Draft, t: Translate, language: Language): TransferGapPrompt | null {
    if (draft.gapAmount === 0 || draft.gapRate === null) {
        return null;
    }
    const offered = offeredRateText(draft, draft.gapRate, language);
    const rateMoves = draft.quotedRate === null || offered !== offeredRateText(draft, draft.quotedRate, language);
    return {
        feeLabel: draft.gapFee === null ? null : t("transfers.gap.itsAFee"),
        message: t("transfers.gap.unaccounted", {
            amount: formatSignedAmount(draft.gapAmount, draft.toCurrency, true, language),
        }),
        onFee: draft.gapFee === null ? null : draft.resolveAsFee,
        onRate: rateMoves ? draft.resolveAsRate : null,
        rateLabel: rateMoves ? t("transfers.gap.rateWas", { rate: offered }) : null,
    };
}
