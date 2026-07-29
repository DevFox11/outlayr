import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { axisMax, CHART_DASH, compactMagnitude, dashArray } from "./chart";

describe("axisMax", () => {
	it("keeps the tallest bar clear of the ceiling", () => {
		assert.ok(axisMax(100) > 100);
		assert.ok(axisMax(9999) > 9999);
	});

	it("never collapses to zero on an empty window", () => {
		assert.equal(axisMax(0), 10);
	});

	it("rounds to a multiple of ten a person would say out loud", () => {
		assert.equal(axisMax(87) % 10, 0);
		assert.equal(axisMax(1234) % 10, 0);
	});

	it("grows monotonically with the peak", () => {
		let previous = 0;
		for (const peak of [0, 5, 50, 500, 5000, 50_000]) {
			const value = axisMax(peak);
			assert.ok(value >= previous, `${peak} produced a smaller max`);
			previous = value;
		}
	});
});

describe("compactMagnitude", () => {
	it("leaves values under a thousand whole", () => {
		assert.equal(compactMagnitude(0), "0");
		assert.equal(compactMagnitude(950), "950");
	});

	it("switches to k at a thousand and M at a million", () => {
		assert.equal(compactMagnitude(1200), "1.2k");
		assert.equal(compactMagnitude(15_000), "15k");
		assert.equal(compactMagnitude(3_000_000), "3M");
	});

	it("drops a trailing .0 rather than printing it", () => {
		assert.equal(compactMagnitude(2000), "2k");
		assert.equal(compactMagnitude(1_000_000), "1M");
	});

	it("keeps one decimal only below the ten-unit mark", () => {
		assert.equal(compactMagnitude(9900), "9.9k");
		assert.equal(compactMagnitude(99_000), "99k");
	});

	it("survives a negative without emitting a stray sign inside the unit", () => {
		assert.equal(compactMagnitude(-1500), "-1.5k");
	});
});

describe("dashArray", () => {
	it("renders the intervals in the form react-native-svg parses", () => {
		assert.equal(dashArray(CHART_DASH.reference), "1.5 4");
		assert.equal(dashArray(CHART_DASH.projection), "3.5 3.5");
	});

	it("keeps reference and projection visually distinguishable", () => {
		const [refOn, refOff] = CHART_DASH.reference;
		const [projOn, projOff] = CHART_DASH.projection;
		assert.ok(refOff / refOn > 2, "reference should read as sparse");
		assert.equal(projOn, projOff, "projection should read as even");
	});
});
