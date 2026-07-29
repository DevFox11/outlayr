import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	affectsSpotlight,
	affectsWidgets,
	debounce,
	PUBLISH_DEBOUNCE_MS,
	SPOTLIGHT_DEBOUNCE_MS,
} from "./sync-cadence";

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("sync cadence", () => {
	it("routes a table change to the surfaces that read it", () => {
		for (const table of ["transactions", "budgets", "categories", "appMeta"]) {
			assert.equal(affectsWidgets(table), true, table);
			assert.equal(affectsSpotlight(table), true, table);
		}
		// The index reads `budgets`, never the overall-budget singleton.
		assert.equal(affectsWidgets("mainBudget"), true);
		assert.equal(affectsSpotlight("mainBudget"), false);

		assert.equal(affectsWidgets("exchangeRates"), false);
		assert.equal(affectsSpotlight("exchangeRates"), false);
	});

	/**
	 * A Spotlight pass rewrites a whole domain, so it must never be paced at the
	 * widgets' write-rate cadence. The gap is the whole reason a second timer
	 * exists rather than reusing the publish one.
	 */
	it("paces the index far behind the tiles", () => {
		assert.ok(SPOTLIGHT_DEBOUNCE_MS >= PUBLISH_DEBOUNCE_MS * 10);
	});

	it("collapses a burst into one trailing run", async () => {
		let runs = 0;
		const debounced = debounce(20, () => {
			runs += 1;
		});
		debounced.schedule();
		debounced.schedule();
		debounced.schedule();
		assert.equal(runs, 0);
		await sleep(60);
		assert.equal(runs, 1);
	});

	it("drops a pending run when cancelled", async () => {
		let runs = 0;
		const debounced = debounce(20, () => {
			runs += 1;
		});
		debounced.schedule();
		debounced.cancel();
		await sleep(60);
		assert.equal(runs, 0);
	});

	it("schedules again after it has run", async () => {
		let runs = 0;
		const debounced = debounce(10, () => {
			runs += 1;
		});
		debounced.schedule();
		await sleep(40);
		debounced.schedule();
		await sleep(40);
		assert.equal(runs, 2);
	});
});
