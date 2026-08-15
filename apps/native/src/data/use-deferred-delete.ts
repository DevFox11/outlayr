import { useEffect, useRef, useState } from "react";

import type { Database } from "@/db/client";
import { createDeferredDelete } from "@/domain/deferred-delete";
import type { DeferredDeleteController } from "@/domain/deferred-delete";
import { translateNow } from "@/i18n/runtime";
import { dismissNotice, notifyFailure, notifyUndoable } from "@/lib/notify";

import { transactionsRepo } from "./transactions-core";
import { transfersRepo } from "./transfers-core";

/**
 * The undo has to be noticed and reached for before the write lands, so the
 * window is sized to the toast that offers it rather than the other way round.
 */
const UNDO_WINDOW_MS = 10_000;

interface DeferredDelete {
    /** Id currently hidden from the list while its undo window is open, or null. */
    pendingId: string | null;
    /** Hides the row now and schedules the write for after the undo window. */
    requestDelete: (id: string) => void;
}

/**
 * The row vanishes immediately (the caller filters on `pendingId`) but the
 * soft-delete write is held for the undo window. A second delete flushes the
 * first, and unmount flushes any pending commit so it is never silently lost.
 *
 * The undo offer and a rejected write are both raised from here rather than
 * handed back for the screen to report. Every screen that deletes this way pairs
 * the two identically, and a failure means nothing was recorded and the row is on
 * the list again — indistinguishable from a lost gesture unless it is said. Both
 * are toasts mounted at the app root, so they outlive the screen that asked for
 * the delete, which the commit routinely does.
 *
 * Which table an id belongs to is read at commit time rather than passed in: a
 * caller deriving it from its own list gets it wrong the moment that list is
 * filtered inside the undo window, and removing a transfer as a transaction
 * updates zero rows and rejects nothing.
 */
export function useDeferredDelete(db: Database): DeferredDelete {
    const [pendingId, setPendingId] = useState<string | null>(null);
    const mountedRef = useRef(false);
    // Read at commit time rather than captured: the controller outlives any one
    // handle, and a delete must land in the database the screen is on now.
    const dbRef = useRef(db);
    useEffect(() => {
        dbRef.current = db;
    }, [db]);

    // A lazy initializer rather than a ref filled in on first render: the
    // controller is created once and never replaced, and building it during
    // render is a side effect the compiler cannot follow.
    const [controller] = useState<DeferredDeleteController>(() => {
        const created = createDeferredDelete({
            commit: async (id) => {
                const transfer = await transfersRepo.getById(dbRef.current, id);
                await (transfer
                    ? transfersRepo.softDelete(dbRef.current, id)
                    : transactionsRepo.remove(dbRef.current, id));
            },
            onChange: (next) => {
                if (mountedRef.current) {
                    setPendingId(next.pendingId);
                }
                if (next.failedId === null) {
                    return;
                }
                notifyFailure({
                    body: translateNow("log.delete.failedBody"),
                    title: translateNow("log.delete.failedTitle"),
                });
                // Dropped as it is shown: the controller holds a failure until it is
                // acknowledged, so leaving it set raises the same alert again on the
                // next publish.
                created.acknowledgeFailure();
            },
            timers: {
                clear: (handle: ReturnType<typeof setTimeout>) => {
                    clearTimeout(handle);
                },
                set: (run: () => void, ms: number) => setTimeout(run, ms),
            },
            windowMs: UNDO_WINDOW_MS,
        });
        return created;
    });

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            controller.flush();
        };
    }, [controller]);

    // Torn down when the window closes rather than left to time out: undo stops
    // working the moment the write commits, and a button that no longer does
    // anything must not still be on screen.
    useEffect(() => {
        if (pendingId === null) {
            return;
        }
        const id = notifyUndoable({
            actionLabel: translateNow("log.undo.action"),
            duration: UNDO_WINDOW_MS,
            onActionPress: controller.undo,
            title: translateNow("log.undo.deleted"),
        });
        return () => dismissNotice(id);
    }, [controller, pendingId]);

    return {
        pendingId,
        requestDelete: controller.requestDelete,
    };
}
