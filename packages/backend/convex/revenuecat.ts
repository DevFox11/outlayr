import { env } from "@outlayr/env/backend";
import { RevenueCat } from "convex-revenuecat";

import { components } from "./_generated/api";

export const PRO_ENTITLEMENT_ID = "pro";

export const revenuecat = new RevenueCat(components.revenuecat, {
    REVENUECAT_WEBHOOK_AUTH: env.REVENUECAT_WEBHOOK_AUTH,
});

export async function isPro(ctx: Parameters<typeof revenuecat.hasEntitlement>[0], userId: string): Promise<boolean> {
    return revenuecat.hasEntitlement(ctx, { appUserId: userId, entitlementId: PRO_ENTITLEMENT_ID });
}

export async function eraseUpstreamCustomer(appUserId: string): Promise<void> {
    if (!env.REVENUECAT_SECRET_KEY) {
        throw new Error("REVENUECAT_SECRET_KEY is not set; the upstream customer cannot be erased");
    }
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
        headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}` },
        method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
        throw new Error(`RevenueCat customer erase failed with ${response.status}`);
    }
}
