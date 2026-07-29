import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	invalidate,
	invalidateAll,
	subscribeToTable,
} from "./table-invalidation";

describe("table invalidation", () => {
	it("notifies every subscriber of the named table", () => {
		const seen: string[] = [];
		const off1 = subscribeToTable("transactions", () => seen.push("a"));
		const off2 = subscribeToTable("transactions", () => seen.push("b"));

		invalidate("transactions");

		assert.deepEqual(seen, ["a", "b"]);
		off1();
		off2();
	});

	it("leaves other tables alone", () => {
		let hits = 0;
		const off = subscribeToTable("budgets", () => {
			hits += 1;
		});

		invalidate("transactions");

		assert.equal(hits, 0);
		off();
	});

	it("stops notifying after unsubscribe", () => {
		let hits = 0;
		const off = subscribeToTable("categories", () => {
			hits += 1;
		});

		invalidate("categories");
		off();
		invalidate("categories");

		assert.equal(hits, 1);
	});

	it("is a no-op for a table nobody is watching", () => {
		assert.doesNotThrow(() => invalidate("nobody-here"));
	});

	it("still reaches the later subscriber when an earlier one unsubscribes itself", () => {
		let reached = false;
		let off1 = () => {};
		off1 = subscribeToTable("mainBudget", () => {
			off1();
		});
		const off2 = subscribeToTable("mainBudget", () => {
			reached = true;
		});

		invalidate("mainBudget");

		assert.equal(reached, true);
		off2();
	});

	it("fires once per distinct table in a batch", () => {
		let hits = 0;
		const off = subscribeToTable("templateTransactions", () => {
			hits += 1;
		});

		invalidateAll(["templateTransactions", "templateTransactions", "appMeta"]);

		assert.equal(hits, 1);
		off();
	});
});
