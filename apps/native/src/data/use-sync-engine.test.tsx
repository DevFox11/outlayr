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

const mockRunSync = jest.fn<() => Promise<{ tables: string[] }>>();
jest.mock("./sync-engine-core", () => ({
    runSync: () => mockRunSync(),
}));

jest.mock("@/lib/convex", () => ({
    syncTransport: () => ({}),
    watchSyncWatermark: () => () => undefined,
}));

jest.mock("./table-invalidation", () => ({ invalidateAll: jest.fn() }));

import { useSyncEngine } from "./use-sync-engine";

/** What the database itself reports after a write, which is a table, not a key. */
function emitChange(tableName: string): void {
    for (const listener of mockListeners) {
        listener({ tableName });
    }
}

describe("useSyncEngine", () => {
    let db: Database;

    beforeEach(() => {
        mockListeners.clear();
        mockRunSync.mockReset();
        mockRunSync.mockResolvedValue({ tables: [] });
        db = migratedDatabase({ foreignKeys: false });
        jest.useFakeTimers();
    });

    /**
     * A clean cycle ends by writing `syncedAt`, which is an `appMeta` write, and
     * the listener is told only the table. Scheduling on the name alone meant
     * every successful sync armed the next one: a foregrounded app hit the
     * backend every two seconds with nothing to send.
     */
    it("does not schedule another round trip after a cycle that had nothing to send", async () => {
        await act(async () => {
            renderHook(() => useSyncEngine(db, false));
        });
        const afterMount = mockRunSync.mock.calls.length;

        // The bookkeeping write the cycle itself just made.
        await act(async () => {
            emitChange("appMeta");
        });
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });

        expect(mockRunSync).toHaveBeenCalledTimes(afterMount);
    });

    it("still syncs when a local write is actually waiting to go out", async () => {
        await act(async () => {
            renderHook(() => useSyncEngine(db, false));
        });
        const afterMount = mockRunSync.mock.calls.length;
        await db.run("INSERT INTO outbox (tableName, localId, enqueuedAt) VALUES ('transactions', 'tx-1', 1)");

        // The listener asks the outbox before it arms the debounce, so the answer
        // has to land before the clock moves.
        await act(async () => {
            emitChange("transactions");
        });
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });

        expect(mockRunSync.mock.calls.length).toBeGreaterThan(afterMount);
    });
});
