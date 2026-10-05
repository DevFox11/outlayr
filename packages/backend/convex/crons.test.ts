import { describe, expect, it } from "vite-plus/test";

import crons from "./crons";

describe("cron registration", () => {
    it("registers the open exchange rates refresh five minutes past every hour", () => {
        const job = crons.crons["refresh open exchange rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toStrictEqual({ cron: "5 * * * *", type: "cron" });
        expect(job?.name).toBe("openexchangerates:fetchRates");
    });

    it("registers the cotizave refresh on a 72-minute interval", () => {
        const job = crons.crons["refresh cotizave ves rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toStrictEqual({ minutes: 72, type: "interval" });
        expect(job?.name).toBe("cotizave:fetchRates");
    });

    it("registers the exchange-rate GC on a 24-hour interval", () => {
        const job = crons.crons["prune stale exchange rates"];
        expect(job).toBeDefined();
        expect(job?.schedule).toStrictEqual({ hours: 24, type: "interval" });
        expect(job?.name).toBe("exchangeRates:pruneStale");
    });

    it("registers the deletion-job sweep on a 24-hour interval", () => {
        const job = crons.crons["drop expired deletion jobs"];
        expect(job).toBeDefined();
        expect(job?.schedule).toStrictEqual({ hours: 24, type: "interval" });
        expect(job?.name).toBe("accountDeletion:cleanupExpired");
    });
});
