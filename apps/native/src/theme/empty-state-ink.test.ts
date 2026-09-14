import { describe, expect, it } from "@jest/globals";

import { ghostInk, MARK_CEILING } from "./empty-state-ink";
import type { EmptyStateTier } from "./empty-state-ink";

const INK = "#010101";

function alphaOf(rgba: string): number {
    const match = rgba.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
    if (!match) {
        throw new Error(`not an rgba string: ${rgba}`);
    }
    return Number(match[1]);
}

const LADDER: readonly EmptyStateTier[] = ["takeover", "inFlow", "insetRow"];

describe("the mark size ladder", () => {
    it("covers every tier", () => {
        expect(LADDER).toStrictEqual(["takeover", "inFlow", "insetRow"]);
    });

    it("descends strictly — each tier is smaller than the one above", () => {
        for (let index = 1; index < LADDER.length; index += 1) {
            const above = MARK_CEILING[LADDER[index - 1]];
            const here = MARK_CEILING[LADDER[index]];
            expect(here < above).toBeTruthy();
        }
    });
});

describe("ghost ink rises as the mark shrinks", () => {
    for (const channel of ["wash", "fill", "rule", "edge"] as const) {
        it(`raises ${channel} at every step down the ladder`, () => {
            for (let index = 1; index < LADDER.length; index += 1) {
                const above = alphaOf(ghostInk(INK, LADDER[index - 1])[channel]);
                const here = alphaOf(ghostInk(INK, LADDER[index])[channel]);
                expect(here > above).toBeTruthy();
            }
        });
    }

    it("keeps the channels ordered wash < fill < rule < edge within a tier", () => {
        for (const tier of LADDER) {
            const ink = ghostInk(INK, tier);
            const [wash, fill, rule, edge] = [
                alphaOf(ink.wash),
                alphaOf(ink.fill),
                alphaOf(ink.rule),
                alphaOf(ink.edge),
            ];
            expect(wash < fill).toBeTruthy();
            expect(fill < rule).toBeTruthy();
            expect(rule < edge).toBeTruthy();
        }
    });

    it("never reaches full ink — a mark is always a ghost", () => {
        for (const tier of LADDER) {
            const ink = ghostInk(INK, tier);
            for (const channel of ["wash", "fill", "rule", "edge"] as const) {
                const alpha = alphaOf(ink[channel]);
                expect(alpha > 0 && alpha < 0.5).toBeTruthy();
            }
        }
    });
});

describe("ghostInk tracks the theme's foreground", () => {
    it("derives every channel from the colour it is given", () => {
        const dark = ghostInk("#ffffff", "takeover");
        for (const channel of ["wash", "fill", "rule", "edge"] as const) {
            expect(dark[channel].startsWith("rgba(255, 255, 255,")).toBeTruthy();
        }
    });

    it("survives a malformed colour without throwing", () => {
        const ink = ghostInk("not-a-colour", "inFlow");
        expect(typeof ink.fill).toBe("string");
    });
});
