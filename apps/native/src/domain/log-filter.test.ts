import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterDetail, filterHasMenu, filterPeriodUnit } from "./log-filter";

const CURSOR = new Date("2026-07-22T15:30:00");
const SCOPE = { cursor: CURSOR, income: false };

describe("filterPeriodUnit", () => {
	it("names a unit only for the filters that scope to a stretch of time", () => {
		assert.equal(filterPeriodUnit("week"), "week");
		assert.equal(filterPeriodUnit("category"), null);
		assert.equal(filterPeriodUnit("all"), null);
	});
});

describe("filterHasMenu", () => {
	it("gives a menu to the filters with something to choose", () => {
		assert.equal(filterHasMenu("month"), true);
		assert.equal(filterHasMenu("category"), true);
		assert.equal(filterHasMenu("type"), true);
	});

	it("withholds one from the filters that are just a label", () => {
		assert.equal(filterHasMenu("recurring"), false);
		assert.equal(filterHasMenu("upcoming"), false);
	});
});

describe("filterDetail", () => {
	it("says nothing when no filter is active", () => {
		assert.equal(filterDetail("all", SCOPE), null);
	});

	it("names the span a period filter is pointed at", () => {
		assert.equal(filterDetail("day", SCOPE), "22 Jul 2026");
		assert.equal(
			filterDetail("week", { ...SCOPE, firstWeekday: 1 }),
			"19 Jul – 25 Jul",
		);
	});

	it("names the pinned category", () => {
		assert.equal(
			filterDetail("category", { ...SCOPE, categoryName: "Groceries" }),
			"Groceries",
		);
	});

	it("falls back to the filter's own name before a category resolves", () => {
		// The chip loads categories asynchronously and must not render blank.
		assert.equal(filterDetail("category", SCOPE), "by category");
		assert.equal(
			filterDetail("category", { ...SCOPE, categoryName: "" }),
			"by category",
		);
	});

	it("names which side a type filter shows", () => {
		assert.equal(filterDetail("type", SCOPE), "Expense");
		assert.equal(filterDetail("type", { ...SCOPE, income: true }), "Income");
	});

	it("names the filters that scope to neither a span nor a thing", () => {
		assert.equal(filterDetail("recurring", SCOPE), "recurring");
		assert.equal(filterDetail("upcoming", SCOPE), "upcoming");
	});
});
