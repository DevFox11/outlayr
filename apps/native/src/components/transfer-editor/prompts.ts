import { formatSignedAmount } from "@/domain/account-display";
import { formatAmount } from "@/domain/money";
import { formatEnteredRate, formatRateFigure, quotePairRate } from "@/domain/transaction-entry-rate";
import { quotedByBcv, rateDeltaLine } from "@/domain/transaction-form-labels";
import type { useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

import type { useTransferDraft } from "./use-transfer-draft";

export interface TransferGapPrompt {
    feeLabel: string | null;
    message: string;
    onFee: (() => void) | null;
    onRate: (() => void) | null;
    onTop: (() => void) | null;
    rateLabel: string | null;
    topLabel: string | null;
}

type Draft = ReturnType<typeof useTransferDraft>;
type Translate = ReturnType<typeof useTranslation>;

export function formatRate(draft: Pick<Draft, "rateInverse">, rate: number | null, language: Language): string | null {
    return rate === null ? null : formatRateFigure(quotePairRate(draft.rateInverse, rate), language);
}

export function rateDeltaNote(draft: Draft, t: Translate, language: Language): string | null {
    const { official } = draft.marketRates;
    const rate = draft.quotedRate;
    if (rate === null || official === null) {
        return null;
    }
    const moved = draft.paid - (draft.feeSide === "source" ? draft.fee : 0);
    return rateDeltaLine(t, {
        bcv: quotedByBcv(draft.fromCurrency, draft.toCurrency),
        code: draft.toCurrency,
        difference: moved > 0 ? moved * (rate - official) : 0,
        language,
        percent: (quotePairRate(draft.rateInverse, rate) / quotePairRate(draft.rateInverse, official) - 1) * 100,
    });
}

function offeredRateText(draft: Pick<Draft, "rateInverse">, rate: number, language: Language): string {
    return formatEnteredRate(quotePairRate(draft.rateInverse, rate), language);
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
        onTop: null,
        rateLabel: null,
        topLabel: null,
    };
}

/** Only offers a resolution that would actually close the gap: a fee only when one
 * above zero does, and a rate only when it differs from the one carried. */
export function gapPrompt(draft: Draft, t: Translate, language: Language): TransferGapPrompt | null {
    const { gapRate } = draft;
    if (draft.gapAmount === 0 || (gapRate === null && !draft.gapOnTop)) {
        return null;
    }
    const offered = gapRate === null ? null : offeredRateText(draft, gapRate, language);
    const arrivalGap = -draft.gapAmount;
    const amount = formatSignedAmount(arrivalGap, draft.feeCurrency, true, language);
    const rateMoves =
        offered !== null &&
        draft.fromCurrency !== draft.toCurrency &&
        (draft.quotedRate === null || offered !== offeredRateText(draft, draft.quotedRate, language));
    return {
        feeLabel: draft.gapFee === null ? null : t("transfers.gap.itsAFee"),
        message: t("transfers.gap.unaccounted", {
            amount: arrivalGap > 0 ? `+${amount}` : amount,
        }),
        onFee: draft.gapFee === null ? null : draft.resolveAsFee,
        onRate: rateMoves ? draft.resolveAsRate : null,
        onTop: draft.gapOnTop ? draft.resolveAsOnTop : null,
        rateLabel: rateMoves ? t("transfers.gap.rateWas", { rate: offered }) : null,
        topLabel: draft.gapOnTop ? t("transfers.gap.itsOnTop") : null,
    };
}
