import {
	HAPTIC_EVENTS,
	HAPTICS_EXCESSIVE,
	HAPTICS_OFF,
	HAPTICS_SUBTLE,
	type HapticEvent,
	hapticPlay,
} from "./haptics";

const LANDINGS: HapticEvent[] = [
	"light",
	"medium",
	"heavy",
	"success",
	"warning",
	"error",
];
const TICKS: HapticEvent[] = ["selection", "keyTap"];

describe("haptics setting", () => {
	it("plays nothing at all on None", () => {
		for (const event of HAPTIC_EVENTS) {
			expect(hapticPlay(HAPTICS_OFF, event)).toBe(null);
		}
	});

	it("plays every event on Excessive", () => {
		for (const event of HAPTIC_EVENTS) {
			expect(hapticPlay(HAPTICS_EXCESSIVE, event)).not.toBe(null);
		}
	});

	it("keeps per-action ticks silent on Subtle", () => {
		for (const event of TICKS) {
			expect(hapticPlay(HAPTICS_SUBTLE, event)).toBe(null);
		}
	});

	it("plays landings on Subtle", () => {
		for (const event of LANDINGS) {
			expect(hapticPlay(HAPTICS_SUBTLE, event)).not.toBe(null);
		}
	});

	it("keeps each landing's declared strength", () => {
		expect(hapticPlay(HAPTICS_SUBTLE, "light")).toStrictEqual({
			kind: "impact",
			style: "light",
		});
		expect(hapticPlay(HAPTICS_SUBTLE, "medium")).toStrictEqual({
			kind: "impact",
			style: "medium",
		});
		expect(hapticPlay(HAPTICS_SUBTLE, "heavy")).toStrictEqual({
			kind: "impact",
			style: "heavy",
		});
		expect(hapticPlay(HAPTICS_SUBTLE, "success")).toStrictEqual({
			kind: "notification",
			type: "success",
		});
		expect(hapticPlay(HAPTICS_SUBTLE, "warning")).toStrictEqual({
			kind: "notification",
			type: "warning",
		});
		expect(hapticPlay(HAPTICS_SUBTLE, "error")).toStrictEqual({
			kind: "notification",
			type: "error",
		});
	});

	it("plays both ticks as a selection tap", () => {
		for (const event of TICKS) {
			expect(hapticPlay(HAPTICS_EXCESSIVE, event)).toStrictEqual({
				kind: "selection",
			});
		}
	});

	it("treats a value outside the three options as its nearest neighbour", () => {
		expect(hapticPlay(-1, "success")).toBe(null);
		expect(hapticPlay(9, "keyTap")).toStrictEqual({ kind: "selection" });
	});
});
