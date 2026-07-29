import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	chunkRows,
	isThrottled,
	RATE_ROWS_PER_CHUNK,
	RATES_THROTTLE_MS,
} from "./rates";

describe("chunkRows", () => {
	it("splits into contiguous chunks with a possibly short tail", () => {
		assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
	});

	it("returns nothing for an empty input", () => {
		assert.deepEqual(chunkRows([], 10), []);
	});

	it("keeps a full snapshot under SQLite's bound-parameter cap", () => {
		// 6 bound params per row against SQLite's 32,766 ceiling.
		assert.ok(RATE_ROWS_PER_CHUNK * 6 < 32_766);
	});
});

describe("isThrottled", () => {
	const now = 1_700_000_000_000;

	it("lets the first ever pull through", () => {
		assert.equal(isThrottled(null, now), false);
	});

	it("holds inside the window and opens on its edge", () => {
		assert.equal(isThrottled(now - 1, now), true);
		assert.equal(isThrottled(now - RATES_THROTTLE_MS + 1, now), true);
		assert.equal(isThrottled(now - RATES_THROTTLE_MS, now), false);
	});

	it("treats a backward clock jump as expired rather than locking shut", () => {
		// A stamp in the future would otherwise hold the throttle closed until
		// the clock caught up — potentially hours with no rates.
		assert.equal(isThrottled(now + 60_000, now), false);
	});
});
