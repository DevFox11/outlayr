/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { TestConvex } from "convex-test";

import { components } from "./_generated/api";

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

export async function seedAuthUser(
	t: AnyTestConvex,
	options?: SeedOptions,
): Promise<SeededIdentity> {
	ensureAuthComponentRegistered(t);

	seedCounter += 1;
	const uniqueSuffix = `${Date.now().toString(36)}-${seedCounter}`;
	const email = options?.email ?? `user-${uniqueSuffix}@example.com`;
	const name = options?.name ?? `Test User ${seedCounter}`;
	const now = Date.now();

	const { userId, sessionId } = await t.run(async (ctx) => {
		const user = (await ctx.runMutation(components.betterAuth.adapter.create, {
			input: {
				model: "user",
				data: {
					name,
					email,
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				},
			},
		})) as { _id: string };

		const session = (await ctx.runMutation(
			components.betterAuth.adapter.create,
			{
				input: {
					model: "session",
					data: {
						userId: user._id,
						token: `session-token-${uniqueSuffix}`,
						expiresAt: now + SESSION_TTL_MS,
						createdAt: now,
						updatedAt: now,
					},
				},
			},
		)) as { _id: string };

		return { userId: user._id, sessionId: session._id };
	});

	return { userId, sessionId, subject: userId, email };
}

export function authenticatedAs(
	t: AnyTestConvex,
	identity: SeededIdentity,
): AnyTestConvex {
	return t.withIdentity({
		subject: identity.subject,
		sessionId: identity.sessionId,
	}) as AnyTestConvex;
}
