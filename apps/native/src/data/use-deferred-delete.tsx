import type { ReactNode } from "react";
import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useLocalData } from "@/contexts/local-data-context";

import { createDeferredDeleteRegistry } from "./deferred-delete-registry";
import type { DeferredDeleteKind, DeferredDeleteRegistry } from "./deferred-delete-registry";

const DeferredDeleteContext = createContext<DeferredDeleteRegistry | null>(null);

/**
 * Mounted at the app root because a held delete outlives the screen that asked
 * for it: the delete on a detail screen navigates straight back, and the list it
 * lands on is the one that has to keep the row hidden.
 *
 * Sits below `LocalDataProvider` and hands the handle down rather than letting
 * the registry capture one, because a delete must land in the database the app
 * is on when the window closes, not the one it was on when the swipe happened.
 */
export function DeferredDeleteProvider({ children }: { children: ReactNode }) {
    const { db } = useLocalData();

    // A lazy initializer rather than a ref filled in on first render: the registry
    // is created once and never replaced, and building it during render is a side
    // effect the compiler cannot follow.
    const [registry] = useState(createDeferredDeleteRegistry);

    useEffect(() => {
        registry.attachDatabase(db);
    }, [registry, db]);

    // A backgrounded app can be killed without warning, and a window still open
    // when that happens takes its write with it — the row is back with no record
    // of the delete. Leaving the foreground closes every window early instead.
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (phase) => {
            if (phase !== "active") {
                registry.flushAll();
            }
        });
        return () => subscription.remove();
    }, [registry]);

    return <DeferredDeleteContext.Provider value={registry}>{children}</DeferredDeleteContext.Provider>;
}

export interface DeferredDelete {
    /** Id hidden from the list while its undo window is open, or null. */
    pendingId: string | null;
    /**
     * Hides the row now and schedules the write for after the undo window.
     * `body` is a translated supporting line for the undo toast — use it where
     * the delete carries a consequence the title cannot state.
     */
    requestDelete: (id: string, body?: string) => void;
}

/**
 * The row vanishes immediately (the caller filters on `pendingId`) but the write
 * is held for the undo window. A second delete of the same kind flushes the
 * first, and leaving the foreground flushes everything, so a delete is never
 * silently lost.
 */
export function useDeferredDelete(kind: DeferredDeleteKind): DeferredDelete {
    const registry = use(DeferredDeleteContext);
    if (registry === null) {
        throw new Error("useDeferredDelete must be used within DeferredDeleteProvider");
    }

    const pendingId = useSyncExternalStore(
        useCallback((listener: () => void) => registry.subscribe(kind, listener), [registry, kind]),
        useCallback(() => registry.pendingId(kind), [registry, kind])
    );

    const requestDelete = useCallback(
        (id: string, body?: string) => {
            registry.requestDelete(kind, id, body);
        },
        [registry, kind]
    );

    return { pendingId, requestDelete };
}
