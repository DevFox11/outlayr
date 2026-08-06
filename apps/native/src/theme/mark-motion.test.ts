import {
	arrivalFrame,
	MARK_MOTION,
	recedeDelay,
	settleFrame,
	staggerDelay,
} from "./mark-motion";

describe("frame builders run on the UI runtime", () => {
	it.each([
		["arrivalFrame", arrivalFrame],
		["settleFrame", settleFrame],
	])(
		"%s is workletized, so useAnimatedStyle can call it without a remote-function crash",
		(_name, fn) => {
			expect(
				(fn as unknown as { __workletHash?: number }).__workletHash,
			).toEqual(expect.any(Number));
		},
	);
});

describe("arrivalFrame", () => {
	it("starts fully clear of the slot and invisible", () => {
		expect(arrivalFrame(0, 46)).toEqual({ opacity: 0, translateY: 46 });
	});

	it("lands settled", () => {
		expect(arrivalFrame(1, 46)).toEqual({ opacity: 1, translateY: 0 });
	});

	it("finishes fading in before the travel ends, so the row is legible while it moves", () => {
		const mid = arrivalFrame(0.5, 46);

		expect(mid.opacity).toBe(1);
		expect(mid.translateY).toBeGreaterThan(0);
	});

	it("clamps a spring overshoot instead of rendering past the slot", () => {
		expect(arrivalFrame(1.4, 46)).toEqual({ opacity: 1, translateY: 0 });
		expect(arrivalFrame(-0.2, 46)).toEqual({ opacity: 0, translateY: 46 });
	});
});

describe("settleFrame", () => {
	it("starts oversized and invisible", () => {
		expect(settleFrame(0, 1.08)).toEqual({ opacity: 0, scale: 1.08 });
	});

	it("lands at true size", () => {
		expect(settleFrame(1, 1.08)).toEqual({ opacity: 1, scale: 1 });
	});

	it("never scales past true size on an overshoot", () => {
		expect(settleFrame(1.3, 1.08).scale).toBe(1);
	});
});

describe("recedeDelay", () => {
	it("staggers each rule down the page", () => {
		expect(recedeDelay(0)).toBe(0);
		expect(recedeDelay(3)).toBe(MARK_MOTION.recede.stagger * 3);
	});

	it("never returns a negative delay", () => {
		expect(recedeDelay(-1)).toBe(0);
		expect(staggerDelay(-1)).toBe(0);
	});
});
