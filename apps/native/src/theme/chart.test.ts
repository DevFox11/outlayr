import { describe, expect, it } from "@jest/globals";

import { axisMax, CHART_DASH, compactMagnitude, dashArray } from "./chart";

describe("axisMax", () => {
    it("keeps the tallest bar clear of the ceiling", () => {
        expect(axisMax(100) > 100).toBeTruthy();
        expect(axisMax(9999) > 9999).toBeTruthy();
    });

    it("never collapses to zero on an empty window", () => {
        expect(axisMax(0)).toBe(10);
    });

    it("rounds to a multiple of ten a person would say out loud", () => {
        expect(axisMax(87) % 10).toBe(0);
        expect(axisMax(1234) % 10).toBe(0);
    });

    it("grows monotonically with the peak", () => {
        let previous = 0;
        for (const peak of [0, 5, 50, 500, 5000, 50_000]) {
            const value = axisMax(peak);
            expect(value >= previous).toBeTruthy();
            previous = value;
        }
    });
});

describe("compactMagnitude", () => {
    it("leaves values under a thousand whole", () => {
        expect(compactMagnitude(0)).toBe("0");
        expect(compactMagnitude(950)).toBe("950");
    });

    it("switches to k at a thousand and M at a million", () => {
        expect(compactMagnitude(1200)).toBe("1.2k");
        expect(compactMagnitude(15_000)).toBe("15k");
        expect(compactMagnitude(3_000_000)).toBe("3M");
    });

    it("drops a trailing .0 rather than printing it", () => {
        expect(compactMagnitude(2000)).toBe("2k");
        expect(compactMagnitude(1_000_000)).toBe("1M");
    });

    it("keeps one decimal only below the ten-unit mark", () => {
        expect(compactMagnitude(9900)).toBe("9.9k");
        expect(compactMagnitude(99_000)).toBe("99k");
    });

    it("survives a negative without emitting a stray sign inside the unit", () => {
        expect(compactMagnitude(-1500)).toBe("-1.5k");
    });
});

describe("dashArray", () => {
    it("renders the intervals in the form react-native-svg parses", () => {
        expect(dashArray(CHART_DASH.reference)).toBe("1.5 4");
        expect(dashArray(CHART_DASH.projection)).toBe("3.5 3.5");
    });

    it("keeps reference and projection visually distinguishable", () => {
        const [refOn, refOff] = CHART_DASH.reference;
        const [projOn, projOff] = CHART_DASH.projection;
        expect(refOff / refOn > 2).toBeTruthy();
        expect(projOn).toBe(projOff);
    });
});
