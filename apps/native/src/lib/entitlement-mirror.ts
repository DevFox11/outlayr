import { cloudAction, convex } from "@/lib/convex";

/**
 * Copies the store's view of the entitlement onto the account, which is what
 * `requirePro` reads. The store and the server can disagree — a webhook can be
 * missed, and a customer who bought before the mirror existed has nothing on
 * the server at all — so this runs whenever a positive entitlement is observed,
 * not only at checkout.
 *
 * True on a build with no backend: there is no mirror to be behind.
 */
export async function mirrorEntitlement(): Promise<boolean> {
    if (convex === null) {
        return true;
    }
    return await cloudAction<Record<string, never>, boolean>("revenuecat:syncFromStore", {}).catch(() => false);
}
