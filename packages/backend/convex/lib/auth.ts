import { ConvexError } from "convex/values";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

/**
 * The single ownership seam for user-scoped functions: the returned id is what
 * gets stored as `userId` and is never accepted as a function argument.
 *
 * `safeGetAuthUser` validates the session row rather than trusting the raw
 * identity, so a revoked or expired session fails here instead of resolving to
 * a live user.
 */
export async function requireUserId(
	ctx: MutationCtx | QueryCtx,
): Promise<string> {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user) {
		throw new ConvexError("Unauthenticated: sign in to access your data");
	}
	return user._id;
}
