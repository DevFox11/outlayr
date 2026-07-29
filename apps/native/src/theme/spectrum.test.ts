import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SPECTRUM_STOPS, spectrumRamp } from "./spectrum";

describe("spectrumRamp", () => {
	it("returns one color per segment", () => {
		assert.equal(spectrumRamp(36).length, 36);
		assert.equal(spectrumRamp(1).length, 1);
	});

	it("returns nothing for a non-positive count", () => {
		assert.deepEqual(spectrumRamp(0), []);
		assert.deepEqual(spectrumRamp(-4), []);
	});

	it("emits well-formed lowercase-safe hex", () => {
		for (const color of spectrumRamp(36)) {
			assert.match(color, /^#[0-9a-f]{6}$/i);
		}
	});

	it("walks the stops in order without collapsing to one hue", () => {
		const ramp = spectrumRamp(36);
		assert.equal(new Set(ramp).size > 20, true);
		// Red leads and red closes: the wrap point must land back where it began.
		assert.equal(channelDistance(ramp[0], ramp.at(-1) as string) < 90, true);
	});

	it("never samples past the final stop", () => {
		// A centre-sampled last segment sits half a step inside the wrap, so it
		// must stay strictly between the penultimate stop and the closing red
		// rather than extrapolating beyond the array.
		const last = spectrumRamp(6).at(-1) as string;
		assert.notEqual(last, SPECTRUM_STOPS.at(-2));
		assert.equal(channelDistance(last, "#FF4444") < 120, true);
	});
});

function channelDistance(a: string, b: string): number {
	const parse = (value: string) => {
		const int = Number.parseInt(value.slice(1), 16);
		return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
	};
	const [ar, ag, ab] = parse(a);
	const [br, bg, bb] = parse(b);
	return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
}
