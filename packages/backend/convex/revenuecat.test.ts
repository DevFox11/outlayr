/// <reference types="vite/client" />

import revenuecatTest from "convex-revenuecat/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { isPro } from "./revenuecat";
import schema from "./schema";
import { seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

const WEBHOOK_PATH = "/webhooks/revenuecat";

function initialPurchase(appUserId: string) {
    const now = Date.now();
    return {
        api_version: "1.0",
        event: {
            app_user_id: appUserId,
            entitlement_ids: ["pro"],
            environment: "SANDBOX",
            event_timestamp_ms: now,
            expiration_at_ms: now + 86_400_000,
            id: `evt-${appUserId}`,
            original_transaction_id: `otx-${appUserId}`,
            period_type: "NORMAL",
            product_id: "com.tryoutlayr.app.pro.monthly",
            purchased_at_ms: now,
            store: "APP_STORE",
            transaction_id: `tx-${appUserId}`,
            type: "INITIAL_PURCHASE",
        },
    };
}

describe("webhook route", () => {
    test("rejects a delivery without the shared secret and mirrors nothing", async () => {
        const t = convexTest(schema, modules);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);

        const response = await t.fetch(WEBHOOK_PATH, {
            body: JSON.stringify(initialPurchase(identity.userId)),
            headers: { Authorization: "Bearer not-the-secret" },
            method: "POST",
        });

        expect(response.status).toBe(401);
        await expect(t.run((ctx) => isPro(ctx, identity.userId))).resolves.toBeFalsy();
    });

    test("an authorised INITIAL_PURCHASE makes the user Pro", async () => {
        const t = convexTest(schema, modules);
        revenuecatTest.register(t);
        const identity = await seedAuthUser(t);
        const other = await seedAuthUser(t);

        const response = await t.fetch(WEBHOOK_PATH, {
            body: JSON.stringify(initialPurchase(identity.userId)),
            headers: { Authorization: `Bearer ${process.env.REVENUECAT_WEBHOOK_AUTH}` },
            method: "POST",
        });

        expect(response.status).toBe(200);
        await expect(t.run((ctx) => isPro(ctx, identity.userId))).resolves.toBeTruthy();
        await expect(t.run((ctx) => isPro(ctx, other.userId))).resolves.toBeFalsy();
    });
});
