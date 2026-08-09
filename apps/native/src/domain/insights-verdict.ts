import type { InsightsMeasure } from "@/data/insights";
import type { TranslateFn } from "@/i18n/context";
import { measureRiseIsFavourable } from "./insights-measure";
import { formatAmount } from "./money";

/** Below this, a window is the same as the one before it and says so. */
const FLAT_BAND = 0.02;

export interface VerdictInput {
	code: string;
	/**
	 * This window's figure and the previous one's, already signed the way the
	 * measure reads: magnitudes for spent and income, the signed net for net.
	 */
	current: number;
	measure: InsightsMeasure;
	prior: number;
	/** What to call the window being compared against, e.g. "2025". */
	priorLabel: string;
	showCents: boolean;
	t: TranslateFn;
	topMover: { name: string; delta: number } | null;
}

export interface Verdict {
	/** The washed pill's text, e.g. "+18%", or null with nothing to compare. */
	badge: string | null;
	/** Whether the change is the good kind. */
	favourable: boolean;
	/** Null when there is nothing to say. */
	sentence: string | null;
}

/**
 * Badge and sentence both go quiet rather than inventing a comparison: a first
 * window has no prior to measure against, and "+100% versus nothing" is not a
 * fact about spending.
 */
export function insightsVerdict(input: VerdictInput): Verdict {
	const { measure, current, prior, priorLabel, topMover, code, showCents, t } = input;

	if (prior === 0) {
		return { badge: null, favourable: true, sentence: null };
	}

	const delta = current - prior;
	const ratio = delta / Math.abs(prior);
	const favourable = measureRiseIsFavourable(measure) ? delta >= 0 : delta <= 0;

	const percent = Math.round(ratio * 100);
	const badge = `${percent > 0 ? "+" : ""}${percent}%`;

	if (Math.abs(ratio) < FLAT_BAND) {
		return {
			badge,
			favourable: true,
			sentence: t("verdict.inLine", { prior: priorLabel }),
		};
	}

	let sentence = t(delta > 0 ? "verdict.moreThan" : "verdict.lessThan", {
		amount: formatAmount(Math.abs(delta), code, showCents),
		prior: priorLabel,
	});

	if (topMover) {
		sentence += ` ${t(topMover.delta > 0 ? "verdict.moverAdded" : "verdict.moverGaveBack", {
			amount: formatAmount(Math.abs(topMover.delta), code, showCents),
			name: topMover.name,
		})}`;
	}

	return { badge, favourable, sentence };
}
