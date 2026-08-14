import type { TranslatableKey } from "@/i18n/catalog";

export interface SyncPresentation {
    detail: TranslatableKey;
    title: TranslatableKey;
}

export interface SyncLabel {
    count?: number;
    key: "settings.sync.upToDate" | "settings.sync.never" | "settings.sync.pending" | "settings.sync.pendingOne";
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
export function syncStatusLabel(pending: number, syncedAt: Date | null): SyncLabel {
    if (pending === 1) {
        return { key: "settings.sync.pendingOne" };
    }
    if (pending > 1) {
        return { count: pending, key: "settings.sync.pending" };
    }
    return syncedAt === null ? { key: "settings.sync.never" } : { key: "settings.sync.upToDate" };
}

/**
 * The heading the sync screen leads with, for a capability kind and the current
 * switch position. Only the two settled kinds distinguish on/off — an
 * unconfigured build or a signed-out device has no switch to describe.
 */
export function syncPresentation(kind: EffectiveCapabilityStatus["kind"], syncEnabled: boolean): SyncPresentation {
    if (kind === "unavailable") {
        return { detail: "settings.account.unavailableDetail", title: "settings.account.unavailable" };
    }
    if (kind === "accountRequired") {
        return { detail: "settings.sync.needsAccount", title: "settings.account.notSignedIn" };
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
