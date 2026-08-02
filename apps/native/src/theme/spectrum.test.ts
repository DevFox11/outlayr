import { SPECTRUM_STOPS, spectrumRamp } from "./spectrum";

describe("spectrumRamp", () => {
	it("returns one color per segment", () => {
		expect(spectrumRamp(36).length).toBe(36);
		expect(spectrumRamp(1).length).toBe(1);
	});

	it("returns nothing for a non-positive count", () => {
		expect(spectrumRamp(0)).toStrictEqual([]);
		expect(spectrumRamp(-4)).toStrictEqual([]);
	});

	it("emits well-formed lowercase-safe hex", () => {
		for (const color of spectrumRamp(36)) {
			expect(color).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("walks the stops in order without collapsing to one hue", () => {
		const ramp = spectrumRamp(36);
		expect(new Set(ramp).size > 20).toBe(true);
		// Red leads and red closes: the wrap point must land back where it began.
		expect(channelDistance(ramp[0], ramp.at(-1) as string) < 90).toBe(true);
	});

	it("never samples past the final stop", () => {
		// A centre-sampled last segment sits half a step inside the wrap, so it
		// must stay strictly between the penultimate stop and the closing red
		// rather than extrapolating beyond the array.
		const last = spectrumRamp(6).at(-1) as string;
		expect(last).not.toBe(SPECTRUM_STOPS.at(-2));
		expect(channelDistance(last, "#FF4444") < 120).toBe(true);
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
