import { withAlpha } from "./shade";

export type EmptyStateTier = "takeover" | "inFlow" | "insetRow";

export const MARK_CEILING = {
    inFlow: 88,
    insetRow: 34,
    takeover: 230,
} satisfies Record<EmptyStateTier, number>;

export interface GhostInk {
    edge: string;
    fill: string;
    rule: string;
    wash: string;
}

const ALPHA = {
    inFlow: { edge: 0.22, fill: 0.13, rule: 0.18, wash: 0.045 },
    insetRow: { edge: 0.26, fill: 0.15, rule: 0.21, wash: 0.055 },
    takeover: { edge: 0.18, fill: 0.105, rule: 0.15, wash: 0.035 },
} satisfies Record<EmptyStateTier, Record<keyof GhostInk, number>>;

export function ghostInk(foreground: string, tier: EmptyStateTier): GhostInk {
    const alpha = ALPHA[tier];
    return {
        edge: withAlpha(foreground, alpha.edge),
        fill: withAlpha(foreground, alpha.fill),
        rule: withAlpha(foreground, alpha.rule),
        wash: withAlpha(foreground, alpha.wash),
    };
}
