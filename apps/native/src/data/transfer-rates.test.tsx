import { describe, expect, it } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";

import { bumpRatesRevision } from "./rates-revision";
import { useTransferRates } from "./transfer-rates";

const OFFICIAL = ["official"] as const;

async function seedRate(db: Database, rate: number): Promise<void> {
    await db.insert(exchangeRates).values({
        date: "2026-09-15",
        fetchedAt: Date.now(),
        quote: "VES",
        rate,
        rateType: "official",
        source: "test",
    });
}

describe("useTransferRates", () => {
    // A refresh opens with an unqualified `DELETE FROM exchangeRates`, which
    // SQLite's truncate optimization exempts from the update hook `useLiveQuery`
    // listens on — so the rows can change with no event at all. That is the whole
    // reason `rates-revision` exists, and this hook was the one that did not read
    // it: the transfer sheet kept quoting the table it opened with.
    it("picks up a refresh that announced itself only through the revision counter", async () => {
        const db = migratedDatabase({ foreignKeys: false });
        const { result } = await renderHook(() => useTransferRates(db, ["USD", "VES"], OFFICIAL));
        expect(result.current.official?.get("VES", "2026-09-15")).toBeNull();

        await seedRate(db, 40);
        expect(result.current.official?.get("VES", "2026-09-15")).toBeNull();

        await act(async () => {
            bumpRatesRevision();
        });

        expect(result.current.official?.get("VES", "2026-09-15")).not.toBeNull();
    });
});
