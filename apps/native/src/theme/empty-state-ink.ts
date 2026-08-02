import { withAlpha } from "./shade";

export type EmptyStateTier = "takeover" | "inFlow" | "insetRow";

export const EMPTY_STATE_TIERS = [
	"takeover",
	"inFlow",
	"insetRow",
] as const satisfies readonly EmptyStateTier[];

export const MARK_CEILING: Record<EmptyStateTier, number> = {
	takeover: 230,
	inFlow: 88,
	insetRow: 34,
};

export interface GhostInk {
	wash: string;
	fill: string;
	rule: string;
	edge: string;
}

const ALPHA: Record<EmptyStateTier, Record<keyof GhostInk, number>> = {
	takeover: { wash: 0.035, fill: 0.105, rule: 0.15, edge: 0.18 },
	inFlow: { wash: 0.045, fill: 0.13, rule: 0.18, edge: 0.22 },
	insetRow: { wash: 0.055, fill: 0.15, rule: 0.21, edge: 0.26 },
};

export function ghostInk(foreground: string, tier: EmptyStateTier): GhostInk {
	const alpha = ALPHA[tier];
	return {
		wash: withAlpha(foreground, alpha.wash),
		fill: withAlpha(foreground, alpha.fill),
		rule: withAlpha(foreground, alpha.rule),
		edge: withAlpha(foreground, alpha.edge),
	};
}
