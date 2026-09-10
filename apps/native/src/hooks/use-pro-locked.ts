import { useRevenueCat } from "@/contexts/revenuecat-context";
import { convex } from "@/lib/convex";

/**
 * Whether Pro can be sold at all. Most of what it unlocks runs on the account
 * service, so a build without one has no checkout — and therefore must not
 * hold any feature behind one.
 */
export function proSellable(): boolean {
    return convex !== null;
}

/**
 * Whether Pro is sellable and this customer has not bought it. A leaf on
 * purpose: the local database reads Pro state at mount, so a gate that also
 * needed `useDatabase` would close a cycle back through it.
 */
export function useProLocked(): boolean {
    const { isConfigured, isPro, isResolved } = useRevenueCat();
    // Unresolved locks nothing: the store answers asynchronously and `isPro`
    // starts false, so gating on it directly would send a paying customer to the
    // paywall for the first moments of every cold launch.
    //
    // Nor does an unsellable build: locking a local feature whose unlock cannot
    // be bought leaves the customer with no way forward at all.
    return proSellable() && isConfigured && isResolved && !isPro;
}

/**
 * Whether Pro is CONFIRMED where it counts, which is not the inverse of
 * `useProLocked`: a build that cannot reach RevenueCat locks nothing and
 * confirms nothing either.
 *
 * Local caps read `useProLocked`, so an unsellable build stays unlimited. Any
 * capability the server gates has to read this instead, and it takes the
 * account mirror rather than the store: `requirePro` reads the mirror, so an
 * entitlement the SDK reports but the server has not been told about would only
 * buy a loop of refused requests.
 */
export function useProEntitled(): boolean {
    const { isConfigured, isMirrored, isPro } = useRevenueCat();
    return isConfigured && isPro && isMirrored;
}

/**
 * Whether the entitlement is still being established. Distinguishes "not
 * entitled" from "not answered yet", which matters wherever settling for the
 * wrong answer is worse than waiting — ledger adoption reconciles against the
 * account, and an early settle exposes the local ledger to edits the
 * reconciliation would then have to merge.
 */
export function useProPending(): boolean {
    const { isConfigured, isPending } = useRevenueCat();
    return isConfigured && isPending;
}
