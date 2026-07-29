import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFETTI_FLIGHT_MS, confettiBurst } from "./confetti";

describe("confetti burst", () => {
	it("emits exactly the requested number of pieces", () => {
		assert.equal(confettiBurst(24, 4, 1).length, 24);
		assert.equal(confettiBurst(1, 4, 1).length, 1);
	});

	it("gives each piece of a burst a distinct key", () => {
		const ids = confettiBurst(30, 4, 2).map((piece) => piece.id);
		assert.equal(new Set(ids).size, 30);
	});

	it("emits nothing for a non-positive count", () => {
		assert.deepEqual(confettiBurst(0, 4, 1), []);
		assert.deepEqual(confettiBurst(-3, 4, 1), []);
	});

	it("is deterministic for a seed, so a re-render never reshuffles a burst", () => {
		assert.deepEqual(confettiBurst(20, 5, 7), confettiBurst(20, 5, 7));
	});

	it("gives a different seed a different burst", () => {
		assert.notDeepEqual(confettiBurst(20, 5, 7), confettiBurst(20, 5, 8));
	});

	it("launches every piece inside the burst width", () => {
		for (const piece of confettiBurst(60, 5, 3)) {
			assert.ok(piece.x >= 0 && piece.x <= 1, `x out of band: ${piece.x}`);
		}
	});

	it("indexes colours inside the palette it was given", () => {
		for (const piece of confettiBurst(60, 5, 3)) {
			assert.ok(Number.isInteger(piece.colorIndex));
			assert.ok(piece.colorIndex >= 0 && piece.colorIndex < 5);
		}
		for (const piece of confettiBurst(10, 1, 3)) {
			assert.equal(piece.colorIndex, 0);
		}
	});

	it("uses every colour of a small palette across a wide burst", () => {
		const used = new Set(
			confettiBurst(60, 4, 11).map((piece) => piece.colorIndex),
		);
		assert.deepEqual([...used].sort(), [0, 1, 2, 3]);
	});

	it("throws every piece up before it falls past the launch point", () => {
		for (const piece of confettiBurst(60, 5, 5)) {
			assert.ok(piece.rise > 0, `rise not upward: ${piece.rise}`);
			assert.ok(piece.fall > piece.rise, "fall does not clear rise");
		}
	});

	it("lands every piece within the flight budget", () => {
		for (const piece of confettiBurst(60, 5, 5)) {
			assert.ok(piece.delayMs >= 0);
			assert.ok(piece.durationMs > 0);
			assert.ok(
				piece.delayMs + piece.durationMs <= CONFETTI_FLIGHT_MS,
				`piece outruns the flight budget: ${piece.delayMs + piece.durationMs}`,
			);
		}
	});

	it("spins pieces both ways", () => {
		const spins = confettiBurst(60, 5, 9).map((piece) => piece.spin);
		assert.ok(spins.some((spin) => spin > 0));
		assert.ok(spins.some((spin) => spin < 0));
	});
});
