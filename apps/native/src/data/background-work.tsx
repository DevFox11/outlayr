import { useEffect, useState } from "react";

import { useDatabase } from "@/contexts/local-data-context";
import { usePhotoReconcile } from "@/data/use-photo-reconcile";
import { usePhotoSync } from "@/data/use-photo-sync";
import { useRecurrenceSweep } from "@/data/use-recurrence-sweep";
import { useSyncEngine } from "@/data/use-sync-engine";
import { useProEntitled } from "@/hooks/use-pro-locked";
import { useCloudAuthenticated } from "@/lib/convex";
import { useEnrichmentQueue } from "@/lib/enrichment-queue";
import { syncSubscriptionReminders } from "@/lib/subscription-reminder-sync";
import { useSystemSync } from "@/lib/use-system-sync";

const IDLE_TIMEOUT_MS = 1000;

export function BackgroundWork() {
    const db = useDatabase();
    const [started, setStarted] = useState(false);
    const proEntitled = useProEntitled();
    const cloudAuthenticated = useCloudAuthenticated();

    useEffect(() => {
        const handle = requestIdleCallback(
            () => {
                setStarted(true);
            },
            { timeout: IDLE_TIMEOUT_MS }
        );
        return () => {
            cancelIdleCallback(handle);
        };
    }, []);

    const ready = started ? db : null;

    // Re-arming from the callback rather than relying on the reminder sync's own
    // foreground listener: both fire on the same AppState event, and the sweep
    // moves the very landing the notices are dated from.
    useRecurrenceSweep(ready, syncSubscriptionReminders);
    // Ordered after the sweep so a subscription that advanced on this foreground
    // is already in the table when the widgets are rebuilt from it.
    useSystemSync(ready);
    useEnrichmentQueue(ready);
    // Inert until the sign-in flow opens the device-local sync gate, and held
    // down entirely without a confirmed entitlement and session — the server
    // refuses a lapsed customer, one it cannot verify, and a missing token.
    useSyncEngine(ready, !proEntitled || !cloudAuthenticated);
    usePhotoReconcile(ready);
    // After the reconciliation, which owns whether a row's path still resolves —
    // running first would upload against paths it is about to repair.
    usePhotoSync(ready, !proEntitled || !cloudAuthenticated);

    return null;
}
