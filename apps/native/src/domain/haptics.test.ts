import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
			assert.equal(
				hapticPlay(HAPTICS_OFF, event),
				null,
				`${event} escaped the None setting`,
			);
		}
	});

	it("plays every event on Excessive", () => {
		for (const event of HAPTIC_EVENTS) {
			assert.notEqual(
				hapticPlay(HAPTICS_EXCESSIVE, event),
				null,
				`${event} is silent on Excessive`,
			);
		}
	});

	it("keeps per-action ticks silent on Subtle", () => {
		for (const event of TICKS) {
			assert.equal(hapticPlay(HAPTICS_SUBTLE, event), null);
		}
	});

	it("plays landings on Subtle", () => {
		for (const event of LANDINGS) {
			assert.notEqual(
				hapticPlay(HAPTICS_SUBTLE, event),
				null,
				`${event} is silent on Subtle`,
			);
		}
	});

	it("keeps each landing's declared strength", () => {
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "light"), {
			kind: "impact",
			style: "light",
		});
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "medium"), {
			kind: "impact",
			style: "medium",
		});
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "heavy"), {
			kind: "impact",
			style: "heavy",
		});
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "success"), {
			kind: "notification",
			type: "success",
		});
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "warning"), {
			kind: "notification",
			type: "warning",
		});
		assert.deepEqual(hapticPlay(HAPTICS_SUBTLE, "error"), {
			kind: "notification",
			type: "error",
		});
	});

	it("plays both ticks as a selection tap", () => {
		for (const event of TICKS) {
			assert.deepEqual(hapticPlay(HAPTICS_EXCESSIVE, event), {
				kind: "selection",
			});
		}
	});

	it("treats a value outside the three options as its nearest neighbour", () => {
		assert.equal(hapticPlay(-1, "success"), null);
		assert.deepEqual(hapticPlay(9, "keyTap"), { kind: "selection" });
	});
});
