import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";

import type { Database } from "@/db/client";
import { isBehindWatermark } from "@/domain/sync-wakeup";
import { syncTransport, watchSyncWatermark } from "@/lib/convex";
import { debounce } from "@/lib/sync-cadence";

import { runSync } from "./sync-engine-core";
import { getSyncCursor, isSyncEnabled, outboxPendingCount, SYNCED_TABLES, setSyncedAt } from "./sync-outbox-core";
import { invalidateAll } from "./table-invalidation";

/**
 * A write is never blocked on the network, so a burst of edits settles before
 * anything is pushed. Longer than the widget cadence because a round trip is
 * far more expensive than rebuilding a tile.
 */
const SYNC_DEBOUNCE_MS = 2000;

const REPLICATED = new Set<string>(SYNCED_TABLES);

/**
 * Drives replication on the same shape as `useSystemSync`: on foreground, and
 * on a debounced local write. Never on the write path itself.
 *
 * Mount, foreground and a local write all fire on something this handset did,
 * so on their own two phones side by side never see each other until one of them
 * is touched. A peer's push therefore arrives as a live watermark instead, and
 * that subscription is what makes replication realtime. The local triggers stay
 * as its fallback: a dropped socket degrades to catching up on the next
 * foreground rather than to not catching up at all.
 *
 * Inert until the device has a backend AND the sync gate is on — the gate is
 * device-local and only the sign-in flow opens it, so a signed-out install runs
 * this hook and does nothing at all.
 *
 * `paused` holds every trigger down while replication is not entitled. The
 * outbox keeps queueing, so nothing is lost and the first cycle after Pro
 * returns drains what accumulated.
 *
 * Failures are swallowed to a warning: the app is local-first, so a failed sync
 * is not a failed save.
 */
export function useSyncEngine(db: Database | null, paused: boolean): void {
    useEffect(() => {
        if (db == null || paused) {
            return;
        }
        const transport = syncTransport();

        let running = false;
        let queued = false;

        const cycle = async () => {
            if (running) {
                // A write that lands mid-cycle is not lost: it is queued in the outbox
                // and this re-runs once for however many arrived.
                queued = true;
                return;
            }
            running = true;
            try {
                do {
                    queued = false;
                    // oxlint-disable-next-line no-await-in-loop -- each pass drains the outbox the previous one left behind, so a second push must not start until the first has been acknowledged.
                    const { tables } = await runSync(db, transport);
                    // Outside the write transaction, so nothing repaints against rows a
                    // rollback is about to remove.
                    invalidateAll(tables);
                } while (queued);
                // Only on a clean pass. A cycle that threw reached the server or did
                // not, and claiming a time for it would date a sync that never landed.
                await setSyncedAt(db, new Date());
            } catch (error) {
                console.warn("[outlayr] sync failed", error);
            } finally {
                running = false;
            }
        };

        const schedule = debounce(SYNC_DEBOUNCE_MS, () => {
            cycle();
        });

        cycle();

        const scheduleIfPending = () => {
            outboxPendingCount(db)
                .then((pending) => {
                    if (pending > 0) {
                        schedule.schedule();
                    }
                })
                .catch((error) => {
                    console.warn("[outlayr] sync schedule check failed", error);
                    schedule.schedule();
                });
        };

        const listener = addDatabaseChangeListener((event) => {
            if (REPLICATED.has(event.tableName)) {
                scheduleIfPending();
            }
        });

        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                cycle();
            } else if (state === "background") {
                schedule.cancel();
            }
        });

        // The cursor is read at wake-up rather than remembered, because this
        // device's own push moves the watermark too: by the time the value arrives
        // the cycle that caused it may already have caught this handset up, and a
        // stale cursor would turn every local write into a second round trip.
        const wake = async (watermark: number) => {
            if (isBehindWatermark(watermark, await getSyncCursor(db))) {
                await cycle();
            }
        };

        // Held open only while the gate is on. Every other trigger here is local and
        // costs nothing when replication is off, but this one opens a live
        // subscription to the backend — a signed-out install would be talking to a
        // server it has no account on, which is the opposite of what local-first
        // promises. The gate is device-local and the sign-in flow flips it, so the
        // subscription is established and torn down as that value changes rather
        // than once at mount.
        let unwatch: (() => void) | null = null;
        let disposed = false;

        const reconcileWatch = async () => {
            const wanted = await isSyncEnabled(db);
            if (disposed || wanted === (unwatch != null)) {
                return;
            }
            if (wanted) {
                unwatch = watchSyncWatermark((watermark) => {
                    wake(watermark).catch((error) => {
                        console.warn("[outlayr] sync wake-up failed", error);
                    });
                });
                return;
            }
            unwatch?.();
            unwatch = null;
        };

        const watchGate = () => {
            reconcileWatch().catch((error) => {
                console.warn("[outlayr] sync watch reconcile failed", error);
            });
        };

        watchGate();

        // Registered after `watchGate` exists rather than beside the other listener:
        // the callback only fires on a later write, but reading a `const` declared
        // below would be a dead-zone throw if that ever stopped being true.
        const gateListener = addDatabaseChangeListener((event) => {
            if (event.tableName === "appMeta") {
                watchGate();
            }
        });

        return () => {
            disposed = true;
            schedule.cancel();
            listener.remove();
            gateListener.remove();
            subscription.remove();
            unwatch?.();
        };
    }, [db, paused]);
}
