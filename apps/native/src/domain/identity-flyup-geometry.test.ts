import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { floatTargetY } from "./identity-flyup-geometry";

/** Half the 164pt floated hero tile. */
const HERO_HALF = 82;

describe("floatTargetY", () => {
	it("centres the hero in the free area above the sheet", () => {
		// iPhone 17 Pro: 874pt tall, a half-detent sheet measuring 426pt.
		assert.equal(
			floatTargetY({
				containerHeight: 874,
				sheetHeight: 426,
				heroHalf: HERO_HALF,
			}),
			224,
		);
	});

	it("centres against a shorter screen's smaller sheet", () => {
		// iPhone SE: 667pt tall, whose half detent is only 333pt.
		assert.equal(
			floatTargetY({
				containerHeight: 667,
				sheetHeight: 333,
				heroHalf: HERO_HALF,
			}),
			167,
		);
	});

	it("floors the hero below the top edge when the sheet leaves no room", () => {
		// Dragging the sheet to its large detent shrinks the free area to nothing;
		// the centre would go negative and clip the tile off the top.
		assert.equal(
			floatTargetY({
				containerHeight: 874,
				sheetHeight: 800,
				heroHalf: HERO_HALF,
			}),
			98,
		);
	});

	it("floors rather than centres exactly at the crossover", () => {
		// Free area == the floored hero band: both branches agree, so neither can
		// drift past the other unnoticed.
		assert.equal(
			floatTargetY({
				containerHeight: 596,
				sheetHeight: 400,
				heroHalf: HERO_HALF,
			}),
			98,
		);
	});
});
