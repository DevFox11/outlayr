import { describe, expect, it } from "@jest/globals";

import { affectsSpotlight, affectsWidgets, debounce, PUBLISH_DEBOUNCE_MS, SPOTLIGHT_DEBOUNCE_MS } from "./sync-cadence";

const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

describe("sync cadence", () => {
    it("routes a table change to the surfaces that read it", () => {
        for (const table of ["transactions", "budgets", "categories", "appMeta"]) {
            expect(affectsWidgets(table)).toBe(true);
            expect(affectsSpotlight(table)).toBe(true);
        }
        // The index reads `budgets`, never the overall-budget singleton.
        expect(affectsWidgets("mainBudget")).toBe(true);
        expect(affectsSpotlight("mainBudget")).toBe(false);

        expect(affectsWidgets("exchangeRates")).toBe(false);
        expect(affectsSpotlight("exchangeRates")).toBe(false);
    });

    /**
     * A Spotlight pass rewrites a whole domain, so it must never be paced at the
     * widgets' write-rate cadence. The gap is the whole reason a second timer
     * exists rather than reusing the publish one.
     */
    it("paces the index far behind the tiles", () => {
        expect(SPOTLIGHT_DEBOUNCE_MS >= PUBLISH_DEBOUNCE_MS * 10).toBeTruthy();
    });

    it("collapses a burst into one trailing run", async () => {
        let runs = 0;
        const debounced = debounce(20, () => {
            runs += 1;
        });
        debounced.schedule();
        debounced.schedule();
        debounced.schedule();
        expect(runs).toBe(0);
        await sleep(60);
        expect(runs).toBe(1);
    });

    it("drops a pending run when cancelled", async () => {
        let runs = 0;
        const debounced = debounce(20, () => {
            runs += 1;
        });
        debounced.schedule();
        debounced.cancel();
        await sleep(60);
        expect(runs).toBe(0);
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
        expect(runs).toBe(2);
    });
});
