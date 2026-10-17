import { describe, expect, it } from "@jest/globals";

import { floatTargetY } from "./identity-flyup-geometry";

/** Half the 164pt floated hero tile. */
const HERO_HALF = 82;

describe("floatTargetY", () => {
    it("centres the hero in the free area above the sheet", () => {
        // iPhone 17 Pro: 874pt tall, a half-detent sheet measuring 426pt.
        expect(
            floatTargetY({
                containerHeight: 874,
                heroHalf: HERO_HALF,
                sheetHeight: 426,
            })
        ).toBe(224);
    });

    it("floors the hero below the top edge when the sheet leaves no room", () => {
        // Dragging the sheet to its large detent shrinks the free area to nothing;
        // the centre would go negative and clip the tile off the top.
        expect(
            floatTargetY({
                containerHeight: 874,
                heroHalf: HERO_HALF,
                sheetHeight: 800,
            })
        ).toBe(98);
    });
});
