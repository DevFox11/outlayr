import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clockAdvances, nextClockTick } from "./clock";

const HOUR_MS = 3_600_000;

/** Local wall clock at `ms`, as [hours, minutes, seconds, milliseconds]. */
function wallTime(ms: number): [number, number, number, number] {
	const d = new Date(ms);
	return [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];
}

/**
 * The zone is forced because the host's own may have no DST at all, in which case
 * the case under test could not arise. `node --test` runs each file in its own
 * process, so the mutation cannot reach another test file.
 */
function inNewYork(body: () => void): void {
	const zone = process.env.TZ;
	process.env.TZ = "America/New_York";
	try {
		body();
	} finally {
		process.env.TZ = zone;
	}
}

describe("next clock tick", () => {
	it("lands on the next local midnight from an arbitrary instant", () => {
		const now = new Date(2025, 6, 15, 9, 41, 12, 345).getTime();

		assert.deepEqual(wallTime(now + nextClockTick(now)), [0, 0, 0, 0]);
	});

	it("arms for the following midnight when armed exactly at one", () => {
		const midnight = new Date(2025, 6, 15).getTime();

		const tick = nextClockTick(midnight);

		assert.ok(tick > 0, "a zero delay fires on the instant it was armed for");
		assert.deepEqual(wallTime(midnight + tick), [0, 0, 0, 0]);
		assert.equal(new Date(midnight + tick).getDate(), 16);
	});

	it("spans 23 hours on the day a clock springs forward, not 24", () => {
		inNewYork(() => {
			assert.notEqual(
				new Date(2026, 2, 8).getTimezoneOffset(),
				new Date(2026, 2, 9).getTimezoneOffset(),
				"the forced zone must actually shift on the day under test",
			);

			assert.equal(nextClockTick(new Date(2026, 2, 8).getTime()), 23 * HOUR_MS);
		});
	});

	it("spans 25 hours on the day a clock falls back", () => {
		inNewYork(() => {
			assert.notEqual(
				new Date(2026, 10, 1).getTimezoneOffset(),
				new Date(2026, 10, 2).getTimezoneOffset(),
				"the forced zone must actually shift on the day under test",
			);

			assert.equal(
				nextClockTick(new Date(2026, 10, 1).getTime()),
				25 * HOUR_MS,
			);
		});
	});

	it("never arms for zero, on any hour of a year that shifts twice", () => {
		inNewYork(() => {
			for (let day = 0; day < 365; day += 1) {
				for (let hour = 0; hour < 24; hour += 1) {
					const now = new Date(2026, 0, 1 + day, hour).getTime();
					const tick = nextClockTick(now);

					assert.ok(tick > 0, `day ${day} hour ${hour} armed for ${tick}ms`);
					assert.deepEqual(
						wallTime(now + tick),
						[0, 0, 0, 0],
						`day ${day} hour ${hour} missed midnight`,
					);
				}
			}
		});
	});
});

describe("clock advance rule", () => {
	it("takes a reading later than the standing one", () => {
		assert.equal(clockAdvances(1_000, 1_500), true);
	});

	it("refuses a repeat, so a burst of triggers restates the reading once", () => {
		assert.equal(clockAdvances(1_000, 1_000), false);
	});

	it("refuses a small step backwards, which would flicker listed rows", () => {
		assert.equal(clockAdvances(1_000, 999), false);
	});

	it("refuses a regression right up to the tolerance", () => {
		const now = 10 * HOUR_MS;
		assert.equal(clockAdvances(now, now - 60_000), false);
	});

	it("takes a correction past the tolerance rather than staying in the future", () => {
		// A clock that jumped forward and was then fixed: refusing this leaves the
		// bound stranded ahead of real time for the life of the process, and every
		// scheduled charge under it reads as money already spent.
		const now = 10 * HOUR_MS;
		assert.equal(clockAdvances(now, now - 60_001), true);
		assert.equal(clockAdvances(now, now - 5 * HOUR_MS), true);
	});
});
