import { ConvexError } from "convex/values";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

/**
 * `safeGetAuthUser` validates the session row rather than trusting the raw
 * identity, so a revoked or expired session resolves to null here even though
 * `ctx.auth.getUserIdentity()` still decodes its unexpired token.
 */
export async function optionalUserId(
	ctx: MutationCtx | QueryCtx,
): Promise<string | null> {
	const user = await authComponent.safeGetAuthUser(ctx);
	return user ? user._id : null;
}

/**
 * The single ownership seam for user-scoped functions: the returned id is what
 * gets stored as `userId` and is never accepted as a function argument.
 */
export async function requireUserId(
	ctx: MutationCtx | QueryCtx,
): Promise<string> {
	const userId = await optionalUserId(ctx);
	if (userId === null) {
		throw new ConvexError("Unauthenticated: sign in to access your data");
	}
	return userId;
}
