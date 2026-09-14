/**
 * Scheduling is injected rather than reached for, so the undo window can be
 * driven off a hand-cranked clock. `Handle` is whatever the host's scheduler
 * hands back.
 */
interface DeferredDeleteTimers<Handle> {
    clear: (handle: Handle) => void;
    set: (run: () => void, ms: number) => Handle;
}

export interface DeferredDeleteSnapshot {
    /**
     * A delete whose write rejected. Nothing reached the database, so the row is
     * back on the list — and a row reappearing with nothing said is
     * indistinguishable from the app having dropped the swipe.
     */
    failedId: string | null;
    /** Id the caller hides from its list while the undo window is open. */
    pendingId: string | null;
}

export interface DeferredDeleteController {
    /** Drops the failure report once it has been delivered. */
    acknowledgeFailure: () => void;
    /** Commits whatever is still pending, e.g. because the screen is going away. Settles once written. */
    flush: () => Promise<void>;
    requestDelete: (id: string) => void;
    snapshot: DeferredDeleteSnapshot;
    undo: () => void;
}

export interface DeferredDeleteOptions<Handle> {
    commit: (id: string) => Promise<void>;
    onChange: (snapshot: DeferredDeleteSnapshot) => void;
    timers: DeferredDeleteTimers<Handle>;
    windowMs: number;
}

/**
 * Hides a row now and writes it later, so the delete can be taken back. Holds no
 * React and no database: the caller supplies the write and the clock.
 */
export function createDeferredDelete<Handle>({
    commit,
    windowMs,
    timers,
    onChange,
}: DeferredDeleteOptions<Handle>): DeferredDeleteController {
    let pendingId: string | null = null;
    let failedId: string | null = null;
    let handle: Handle | null = null;

    const controller: DeferredDeleteController = {
        acknowledgeFailure,
        flush,
        requestDelete,
        snapshot: { failedId: null, pendingId: null },
        undo,
    };

    function publish() {
        controller.snapshot = { failedId, pendingId };
        onChange(controller.snapshot);
    }

    function cancelTimer() {
        if (handle !== null) {
            timers.clear(handle);
            handle = null;
        }
    }

    function write(id: string): Promise<void> {
        return commit(id).catch(() => {
            // The window has already closed and the row is on the list again, with
            // nothing recorded. Reporting is the only thing that separates that from
            // the app having lost the gesture.
            failedId = id;
            publish();
        });
    }

    function requestDelete(id: string) {
        // Only one row can be hidden at a time, so a delete already in its window
        // commits now rather than being dropped.
        if (pendingId !== null && pendingId !== id) {
            write(pendingId);
        }
        cancelTimer();
        pendingId = id;
        publish();
        handle = timers.set(() => {
            handle = null;
            pendingId = null;
            publish();
            write(id);
        }, windowMs);
    }

    function undo() {
        cancelTimer();
        pendingId = null;
        publish();
    }

    function acknowledgeFailure() {
        failedId = null;
        publish();
    }

    async function flush() {
        cancelTimer();
        if (pendingId === null) {
            return;
        }
        const id = pendingId;
        pendingId = null;
        // No snapshot for the hide ending: the caller is tearing down and has nothing
        // left to draw. A rejected write still publishes, which is how a failure
        // survives the teardown.
        await write(id);
    }

    return controller;
}
