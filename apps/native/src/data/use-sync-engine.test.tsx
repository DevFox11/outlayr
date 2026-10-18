import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";

type ChangeListener = (event: { tableName: string; rowId: number }) => void;

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

let mockCountFails = false;
const mockCountCalls = jest.fn();
jest.mock("./sync-outbox-core", () => {
    const actual = jest.requireActual<typeof import("./sync-outbox-core")>("./sync-outbox-core");
    return {
        ...actual,
        outboxPendingCount: (...args: Parameters<typeof actual.outboxPendingCount>) => {
            mockCountCalls();
            return mockCountFails
                ? Promise.reject(new Error("database is closed"))
                : actual.outboxPendingCount(...args);
        },
    };
});

import { useSyncEngine } from "./use-sync-engine";

function emitChange(tableName: string, rowId = 1): void {
    for (const listener of mockListeners) {
        listener({ tableName, rowId });
    }
}

describe("useSyncEngine", () => {
    let db: Database;

    beforeEach(() => {
        mockListeners.clear();
        mockCountFails = false;
        mockCountCalls.mockClear();
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
            jest.advanceTimersByTime(0);
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
            jest.advanceTimersByTime(0);
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
            jest.advanceTimersByTime(0);
        });
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });

        expect(mockRunSync.mock.calls.length).toBeGreaterThan(afterMount);
    });

    it("counts the outbox once for a burst of row events", async () => {
        await act(async () => {
            renderHook(() => useSyncEngine(db, false));
        });
        mockCountCalls.mockClear();

        await act(async () => {
            for (let rowId = 1; rowId <= 300; rowId += 1) {
                emitChange("transactions", rowId);
            }
            jest.advanceTimersByTime(0);
        });

        expect(mockCountCalls).toHaveBeenCalledTimes(1);
    });
});
