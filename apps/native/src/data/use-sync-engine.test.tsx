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

let mockCountFails = false;
jest.mock("./sync-outbox-core", () => {
    const actual = jest.requireActual<typeof import("./sync-outbox-core")>("./sync-outbox-core");
    return {
        ...actual,
        outboxPendingCount: (...args: Parameters<typeof actual.outboxPendingCount>) =>
            mockCountFails ? Promise.reject(new Error("database is closed")) : actual.outboxPendingCount(...args),
    };
});

import { useSyncEngine } from "./use-sync-engine";

function emitChange(tableName: string): void {
    for (const listener of mockListeners) {
        listener({ tableName });
    }
}

describe("useSyncEngine", () => {
    let db: Database;

    beforeEach(() => {
        mockListeners.clear();
        mockCountFails = false;
        mockRunSync.mockReset();
        mockRunSync.mockResolvedValue({ tables: [] });
        db = migratedDatabase({ foreignKeys: false });
        jest.useFakeTimers();
    });

    it("does not schedule another round trip after a cycle that had nothing to send", async () => {
        await act(async () => {
            renderHook(() => useSyncEngine(db, false));
        });
        const afterMount = mockRunSync.mock.calls.length;

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

        await act(async () => {
            emitChange("transactions");
        });
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });

        expect(mockRunSync.mock.calls.length).toBeGreaterThan(afterMount);
    });

    it("still syncs when the pending count itself cannot be read", async () => {
        await act(async () => {
            renderHook(() => useSyncEngine(db, false));
        });
        const afterMount = mockRunSync.mock.calls.length;
        mockCountFails = true;

        await act(async () => {
            emitChange("transactions");
        });
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });

        expect(mockRunSync.mock.calls.length).toBeGreaterThan(afterMount);
    });
});
