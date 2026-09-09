/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";

import { components } from "./_generated/api";
import { PRO_ENTITLEMENT_ID, revenuecat } from "./revenuecat";

/**
 * `safeGetAuthUser` resolves the caller by looking up a `session` row whose
 * `_id` equals `identity.sessionId` (and is unexpired) and then a `user` row
 * whose `_id` equals `identity.subject`. Both rows must be seeded in the Better
 * Auth component for `withIdentity` to resolve to a user.
 *
 * The `.helpers.ts` basename is load-bearing: the Convex bundler skips files
 * whose basename has more than one dot, keeping `convex-test`/`vitest` imports
 * out of the deployed function bundle.
 */

const SESSION_TTL_MS = 86_400_000;

// The Better Auth register helper is typed against the generic component
// schema, so tests hand their concrete `t` through this widened alias.
type AnyTestConvex = TestConvex<SchemaDefinition<GenericSchema, boolean>>;

export interface SeededIdentity {
    email: string;
    sessionId: string;
    subject: string;
    userId: string;
}

interface SeedOptions {
    email?: string;
    name?: string;
}

const registeredInstances = new WeakSet<object>();
let seedCounter = 0;

/**
 * `registerComponent` replaces the component's in-memory database, so calling
 * it twice would wipe previously seeded users.
 */
function ensureAuthComponentRegistered(t: AnyTestConvex): void {
    if (registeredInstances.has(t)) {
        return;
    }
    betterAuthTest.register(t);
    registeredInstances.add(t);
}

export async function seedAuthUser(t: AnyTestConvex, options?: SeedOptions): Promise<SeededIdentity> {
    ensureAuthComponentRegistered(t);

    seedCounter += 1;
    const uniqueSuffix = `${Date.now().toString(36)}-${seedCounter}`;
    const email = options?.email ?? `user-${uniqueSuffix}@example.com`;
    const name = options?.name ?? `Test User ${seedCounter}`;
    const now = Date.now();

    const { userId, sessionId } = await t.run(async (ctx) => {
        const user = (await ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
                data: {
                    createdAt: now,
                    email,
                    emailVerified: true,
                    name,
                    updatedAt: now,
                },
                model: "user",
            },
        })) as { _id: string };

        const session = (await ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
                data: {
                    createdAt: now,
                    expiresAt: now + SESSION_TTL_MS,
                    token: `session-token-${uniqueSuffix}`,
                    updatedAt: now,
                    userId: user._id,
                },
                model: "session",
            },
        })) as { _id: string };

        return { sessionId: session._id, userId: user._id };
    });

    return { email, sessionId, subject: userId, userId };
}

export function authenticatedAs(t: AnyTestConvex, identity: SeededIdentity): AnyTestConvex {
    return t.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.subject,
    }) as AnyTestConvex;
}

export async function grantPro(t: AnyTestConvex, identity: Pick<SeededIdentity, "userId">): Promise<void> {
    await t.run((ctx) =>
        revenuecat.syncSubscriber(ctx, {
            appUserId: identity.userId,
            subscriber: {
                entitlements: {
                    [PRO_ENTITLEMENT_ID]: {
                        expires_date: null,
                        product_identifier: "com.tryoutlayr.app.pro.lifetime",
                        purchase_date: new Date().toISOString(),
                    },
                },
            },
        })
    );
}
