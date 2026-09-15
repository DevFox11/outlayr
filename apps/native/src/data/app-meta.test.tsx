import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";

type ChangeListener = (event: { tableName: string }) => void;

const mockListeners = new Set<ChangeListener>();
jest.mock("expo-sqlite", () => ({
    addDatabaseChangeListener: (listener: ChangeListener) => {
        mockListeners.add(listener);
        return {
            remove: () => {
                mockListeners.delete(listener);
            },
        };
    },
}));

import { useGlobalCurrency } from "./app-meta";
import { META_KEYS, setMeta } from "./app-meta-core";

/** One `appMeta` write, as expo-sqlite reports it. */
function announceMetaWrite(): void {
    for (const listener of mockListeners) {
        listener({ tableName: "appMeta" });
    }
}

describe("useGlobalCurrency", () => {
    let db: Database;

    beforeEach(async () => {
        mockListeners.clear();
        db = migratedDatabase({ foreignKeys: false });
        await setMeta(db, META_KEYS.currency, "EUR");
    });

    it("reads the stored currency", async () => {
        const { result } = await renderHook(() => useGlobalCurrency(db));

        expect(result.current).toBe("EUR");
    });

    // `appMeta` is one invalidation channel for the whole table, so a settings
    // toggle and every sync cycle's `syncedAt` write reach this read. Handing
    // back a fresh row array re-rendered all 38 call sites for a value none of
    // them had seen change.
    it("does not re-render its callers when an unrelated setting is written", async () => {
        let renders = 0;
        const { result } = await renderHook(() => {
            renders += 1;
            return useGlobalCurrency(db);
        });
        const before = renders;

        await setMeta(db, META_KEYS.syncedAt, "1700000000000");
        await act(async () => {
            announceMetaWrite();
        });

        expect(renders).toBe(before);
        expect(result.current).toBe("EUR");
    });

    it("still follows its own key", async () => {
        const { result } = await renderHook(() => useGlobalCurrency(db));

        await setMeta(db, META_KEYS.currency, "JPY");
        await act(async () => {
            announceMetaWrite();
        });

        expect(result.current).toBe("JPY");
    });
});
