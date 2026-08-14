import { describe, expect, test } from "vitest";

import crons from "./crons";

describe("crons", () => {
    test("registers the frankfurter refresh on a 12-hour interval", () => {
        const job = crons.crons["refresh frankfurter rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toEqual({ hours: 12, type: "interval" });
        expect(job?.name).toBe("frankfurter:fetchRates");
    });

    test("registers the cotizave refresh on a 72-minute interval", () => {
        const job = crons.crons["refresh cotizave ves rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toEqual({ minutes: 72, type: "interval" });
        expect(job?.name).toBe("cotizave:fetchRates");
    });

    test("registers the exchange-rate GC on a 24-hour interval", () => {
        const job = crons.crons["prune stale exchange rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toEqual({ hours: 24, type: "interval" });
        expect(job?.name).toBe("exchangeRates:pruneStale");
    });
});
