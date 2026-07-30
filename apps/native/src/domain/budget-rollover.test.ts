import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUDGET_TYPE } from "./budget-math";
import {
	effectiveLimit,
	MAX_CARRY_PERIODS,
	rolloverCarry,
} from "./budget-rollover";

const MONTH = BUDGET_TYPE.month;

/**
 * Local time throughout, matching the calendar arithmetic the budget math does.
 * Building these in UTC silently shifts every boundary by the host's offset.
 */
function localKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Spend keyed by the window's start, so a test states one figure per window. */
function spendBy(byStart: Record<string, number>) {
	return (start: Date) => byStart[localKey(start)] ?? 0;
}

function monthWindow(year: number, month: number) {
	return {
		start: new Date(year, month, 1),
		end: new Date(year, month + 1, 1),
	};
}

describe("carrying a budget forward", () => {
	it("carries nothing when the current window is the first one", () => {
		const carry = rolloverCarry({
			anchor: new Date(2026, 6, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: () => 0,
		});
		assert.deepEqual(carry, { credit: 0, periods: 0, clamped: false });
	});

	it("carries what a closed window left unspent", () => {
		const carry = rolloverCarry({
			anchor: new Date(2026, 5, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: spendBy({ "2026-06-01": 300 }),
		});
		assert.equal(carry.credit, 200);
		assert.equal(carry.periods, 1);
	});

	it("carries an overspend as a debt rather than forgetting it", () => {
		// Clamping here would reward overspending: spend double one month and the
		// next would start clean.
		const carry = rolloverCarry({
			anchor: new Date(2026, 5, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: spendBy({ "2026-06-01": 900 }),
		});
		assert.equal(carry.credit, -400);
	});

	it("accumulates across several closed windows", () => {
		const carry = rolloverCarry({
			anchor: new Date(2026, 3, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: spendBy({
				"2026-04-01": 400,
				"2026-05-01": 700,
				"2026-06-01": 450,
			}),
		});
		// +100, -200, +50
		assert.equal(carry.credit, -50);
		assert.equal(carry.periods, 3);
	});

	it("never counts the current window against itself", () => {
		// The current window is still being spent in; crediting it would hand the
		// same allowance out twice.
		const carry = rolloverCarry({
			anchor: new Date(2026, 5, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: spendBy({ "2026-06-01": 300, "2026-07-01": 999 }),
		});
		assert.equal(carry.credit, 200);
	});

	it("stops at the anchor rather than crediting windows before the budget", () => {
		const carry = rolloverCarry({
			anchor: new Date(2026, 5, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 500,
			spentIn: spendBy({ "2026-06-01": 500, "2026-05-01": 0, "2026-04-01": 0 }),
		});
		assert.equal(carry.periods, 1);
		assert.equal(carry.credit, 0);
	});

	it("reports a clamp instead of walking an anchor years back", () => {
		const carry = rolloverCarry({
			anchor: new Date(1990, 0, 1),
			current: monthWindow(2026, 6),
			type: MONTH,
			limit: 0,
			spentIn: () => 0,
		});
		assert.equal(carry.periods, MAX_CARRY_PERIODS);
		assert.equal(carry.clamped, true);
	});

	it("terminates on a type whose period cannot step backwards", () => {
		const carry = rolloverCarry({
			anchor: new Date(1990, 0, 1),
			current: monthWindow(2026, 6),
			type: 999,
			limit: 500,
			spentIn: () => 0,
		});
		assert.deepEqual(carry, { credit: 0, periods: 0, clamped: false });
	});
});

describe("the limit a window actually runs on", () => {
	it("adds an unspent carry to the target", () => {
		assert.equal(effectiveLimit(500, 200), 700);
	});

	it("subtracts a debt from the target", () => {
		assert.equal(effectiveLimit(500, -200), 300);
	});

	it("floors at zero rather than handing a negative target downstream", () => {
		// Every rail, percentage and "left this period" figure reads a negative
		// limit as nonsense. The debt is not lost — it is still in the carry, which
		// is what the screen reports.
		assert.equal(effectiveLimit(500, -900), 0);
	});
});
