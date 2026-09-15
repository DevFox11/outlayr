import type { TranslatableKey } from "@/i18n/catalog";

export interface SyncPresentation {
    detail: TranslatableKey;
    title: TranslatableKey;
}

export interface SyncLabel {
    count?: number;
    key:
        | "settings.sync.upToDate"
        | "settings.sync.never"
        | "settings.sync.pending"
        | "settings.sync.pendingOne"
        | "settings.sync.paused"
        | "settings.sync.off";
}

export interface SyncLabelProbe {
    /** The stored switch. Off is a state of its own, not an idle queue. */
    enabled: boolean;
    paused: boolean;
    pending: number;
    syncedAt: Date | null;
}

export type EffectiveCapabilityStatus =
    | { kind: "local" }
    | { kind: "unavailable" }
    | { kind: "accountRequired" }
    | { enableSync: true; kind: "syncOff" }
    | { kind: "active"; pending: number; syncedAt: Date | null };

export interface CapabilityStatusProbe {
    accountId: string | null;
    cloud: "configured" | "misconfigured" | "unconfigured";
    local: boolean;
    pending: number;
    syncEnabled: boolean;
    syncedAt: Date | null;
}

export function effectiveCapabilityStatus(probe: CapabilityStatusProbe): EffectiveCapabilityStatus {
    if (probe.local) {
        return { kind: "local" };
    }
    if (probe.cloud !== "configured") {
        return { kind: "unavailable" };
    }
    if (probe.accountId === null) {
        return { kind: "accountRequired" };
    }
    if (!probe.syncEnabled) {
        return { enableSync: true, kind: "syncOff" };
    }
    return { kind: "active", pending: probe.pending, syncedAt: probe.syncedAt };
}

/**
 * What the Settings sync row says.
 *
 * An empty queue reads "Up to date" rather than "0 waiting": both are true, and
 * only one of them answers what the user opened the row to ask. A device that
 * has never completed a cycle says so instead, because "up to date" on a ledger
 * the server has never seen is a lie the user cannot check.
 *
 * The pending count is the only failure signal, deliberately. §8.7 of
 * `docs/convex-sync-design.md` settles the UX as silent-and-retrying — a count
 * that stops falling is honest about what is true without guessing at why.
 */
export function syncStatusLabel({ enabled, paused, pending, syncedAt }: SyncLabelProbe): SyncLabel {
    // Ahead of everything else, and for the same reason `paused` is: the queue
    // and the timestamp both describe a cycle that is no longer running.
    // Turning sync off DELETES the outbox, so `pending` is 0 the moment the
    // switch moves — the wipe is what made the wrong label confident.
    if (!enabled) {
        return { key: "settings.sync.off" };
    }
    // "Up to date" off a stale timestamp is the one thing a paused row must not
    // say.
    if (paused) {
        return { key: "settings.sync.paused" };
    }
    if (pending === 1) {
        return { key: "settings.sync.pendingOne" };
    }
    if (pending > 1) {
        return { count: pending, key: "settings.sync.pending" };
    }
    return syncedAt === null ? { key: "settings.sync.never" } : { key: "settings.sync.upToDate" };
}

/**
 * Whether replication may run. The stored switch is the user's intent and
 * outlives an entitlement, so a lapsed Pro pauses the engines here rather than
 * by rewriting the flag — resubscribing restores sync without the user having
 * to find the switch again.
 *
 * Keyed on a CONFIRMED entitlement rather than on the absence of a lock: the
 * server refuses an unproven customer, so a build that cannot reach RevenueCat
 * must pause too instead of retrying into rejections.
 */
export function syncRunnable(syncEnabled: boolean, proEntitled: boolean): boolean {
    return syncEnabled && proEntitled;
}

/**
 * Replication the user asked for and the entitlement is withholding. NOT the
 * inverse of `syncRunnable`, which is also false for a switch that is simply
 * off — telling a Free user who never enabled sync that it is "paused" reports
 * a loss they never had.
 */
export function syncPaused(syncEnabled: boolean, proEntitled: boolean): boolean {
    return syncEnabled && !proEntitled;
}

/**
 * The heading the sync screen leads with, for a capability kind and the current
 * switch position. Only the two settled kinds distinguish on/off — an
 * unconfigured build or a signed-out device has no switch to describe.
 *
 * A switch left on without a confirmed entitlement reads as paused, not off:
 * the device is not syncing, and "off" would blame a choice the user did not
 * make.
 */
export function syncPresentation(
    kind: EffectiveCapabilityStatus["kind"],
    syncEnabled: boolean,
    proEntitled: boolean
): SyncPresentation {
    if (kind === "unavailable") {
        return { detail: "settings.account.unavailableDetail", title: "settings.account.unavailable" };
    }
    if (kind === "accountRequired") {
        return { detail: "settings.sync.needsAccount", title: "settings.account.notSignedIn" };
    }
    if (syncPaused(syncEnabled, proEntitled)) {
        return { detail: "settings.sync.pausedDetail", title: "settings.sync.paused" };
    }
    return syncEnabled
        ? { detail: "settings.sync.onDetail", title: "settings.sync.on" }
        : { detail: "settings.sync.offDetail", title: "settings.sync.off" };
}

/**
 * Whether this device owns the sync switch at all. Adoption has to have settled
 * — mid-reconcile the switch would offer a choice the engine is still making —
 * and the capability has to be one of the two the account actually reached.
 */
export function ownsSyncSwitch(kind: EffectiveCapabilityStatus["kind"], adoptionStatus: string): boolean {
    return adoptionStatus === "settled" && (kind === "active" || kind === "syncOff");
}
