import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

/**
 * The sweep derives an occurrence id so two devices that both advance the same
 * schedule write one row rather than two. That only holds if the derivation is
 * independent of the sweeping device's zone — it used to key on local midnight,
 * which gave Madrid and New York different ids for the same charge and doubled
 * every subscription across a synced pair.
 */
function occurrenceIdIn(timeZone: string, parentLocalId: string, isoHolding: string): string {
    const probe = join(import.meta.dirname, "occurrence-id-probe.ts");
    return execFileSync(process.execPath, ["--import", "tsx", probe, parentLocalId, isoHolding], {
        encoding: "utf-8",
        env: { ...process.env, TZ: timeZone },
    });
}

describe("occurrence id", () => {
    // The failing shape: 23:30Z is already tomorrow in Madrid and still today in
    // New York, so a local-midnight seed disagreed by a whole day here.
    it("agrees across a zone split that straddles the local date", () => {
        const madrid = occurrenceIdIn("Europe/Madrid", "sub-1", "2025-08-10T23:30:00.000Z");
        const newYork = occurrenceIdIn("America/New_York", "sub-1", "2025-08-10T23:30:00.000Z");

        expect(madrid).toBe(newYork);
    });

    it("still separates two different days of the same schedule", () => {
        const august = occurrenceIdIn("UTC", "sub-1", "2025-08-10T09:00:00.000Z");
        const september = occurrenceIdIn("UTC", "sub-1", "2025-09-10T09:00:00.000Z");

        expect(august).not.toBe(september);
    });
});
