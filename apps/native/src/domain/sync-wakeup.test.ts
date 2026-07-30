import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBehindWatermark } from "./sync-wakeup";

describe("isBehindWatermark", () => {
	it("does not wake a device that has applied the whole log", () => {
		// `nextSeq` is one past the highest seq the server has handed out, so a
		// cursor of 7 against a watermark of 8 is fully caught up.
		assert.equal(isBehindWatermark(8, 7), false);
	});

	it("does not wake an account that has never pushed", () => {
		assert.equal(isBehindWatermark(0, 0), false);
	});

	it("does not wake on a watermark equal to the cursor", () => {
		assert.equal(isBehindWatermark(7, 7), false);
	});

	it("does not wake on a watermark below the cursor", () => {
		assert.equal(isBehindWatermark(4, 7), false);
	});

	it("wakes on a single row this device has not seen", () => {
		assert.equal(isBehindWatermark(9, 7), true);
	});

	it("wakes on the first row an account ever pushed", () => {
		assert.equal(isBehindWatermark(2, 0), true);
	});

	it("wakes a device that is many rows behind", () => {
		assert.equal(isBehindWatermark(4218, 7), true);
	});

	it("ignores a watermark that is not a whole number", () => {
		assert.equal(isBehindWatermark(9.5, 7), false);
	});

	it("ignores a watermark that is not finite", () => {
		assert.equal(isBehindWatermark(Number.POSITIVE_INFINITY, 7), false);
		assert.equal(isBehindWatermark(Number.NaN, 7), false);
	});
});
