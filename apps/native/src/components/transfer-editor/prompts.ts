import { formatSignedAmount } from "@/domain/account-display";
import { formatAmount } from "@/domain/money";
import type { useTranslation } from "@/i18n/context";
import type { TransferGapPrompt } from "./slip";
import { RATE_DISPLAY_DECIMALS, type useTransferDraft } from "./use-transfer-draft";

type Draft = ReturnType<typeof useTransferDraft>;
type Translate = ReturnType<typeof useTranslation>;

export function formatRate(rate: number | null): string {
	return rate === null ? "—" : rate.toFixed(RATE_DISPLAY_DECIMALS);
}

export function blockMessage(draft: Draft, t: Translate): string {
	if (draft.block === null || draft.block.kind === "rate") {
		return t("transfers.rate.unavailable");
	}
	return draft.block.shortfall > 0
		? t("transfers.block.feeOverArrival", {
				amount: formatAmount(draft.block.shortfall, draft.feeCurrency),
			})
		: t("transfers.block.nothingArrives");
}

/** No resolution to offer: no fee or rate the screen could invent gives a blocked
 * transfer legs, so the prompt only names what does not add up. */
export function blockPrompt(draft: Draft, t: Translate): TransferGapPrompt | null {
	if (draft.block === null) {
		return null;
	}
	return {
		feeLabel: null,
		message: blockMessage(draft, t),
		onFee: null,
		onRate: null,
		rateLabel: null,
	};
}

/** Only offers a resolution that would actually move the gap: a negative one is no
 * fee, and a rate the transfer already carries changes nothing. */
export function gapPrompt(draft: Draft, t: Translate): TransferGapPrompt | null {
	if (draft.gapAmount === 0 || draft.gapRate === null) {
		return null;
	}
	const rateMoves = draft.effectiveRate === null || formatRate(draft.gapRate) !== formatRate(draft.effectiveRate);
	return {
		feeLabel: draft.gapFee === null ? null : t("transfers.gap.itsAFee"),
		message: t("transfers.gap.unaccounted", {
			amount: formatSignedAmount(draft.gapAmount, draft.toCurrency),
		}),
		onFee: draft.gapFee === null ? null : draft.resolveAsFee,
		onRate: rateMoves ? draft.resolveAsRate : null,
		rateLabel: rateMoves ? t("transfers.gap.rateWas", { rate: formatRate(draft.gapRate) }) : null,
	};
}
