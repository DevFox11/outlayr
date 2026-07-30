import { env } from "@outlayr/env/native";
import { ConvexReactClient } from "convex/react";
import type { PhotoTransport } from "@/data/photo-sync-core";
import type { PullRatesFn } from "@/data/rates";
import type { PullFn, PushFn } from "@/data/sync-engine-core";

/**
 * The Convex client, or null when this build has no backend configured: this app
 * only reads exchange rates from Convex, so the URL is optional — see
 * `@outlayr/env/native`.
 */
export const convex = env.EXPO_PUBLIC_CONVEX_URL
	? new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
			unsavedChangesWarning: false,
		})
	: null;

/**
 * The rate snapshot fetcher, or null when there is no backend — returning null
 * rather than throwing lets the caller skip cleanly, so a missing backend
 * degrades to "no fresh rates" rather than to a crash.
 */
export function ratesPuller(): PullRatesFn | null {
	if (!convex) {
		return null;
	}
	return async (args) =>
		// Addressed by path rather than through the generated API:
		// `packages/backend` is not a build dependency of the app, and the wire
		// shape is pinned by `PullRatesPage` plus the backend's own tests.
		convex.query("exchangeRates:pullRates" as never, (args ?? {}) as never);
}

/**
 * The replication transport, or null when there is no backend.
 *
 * Authentication rides on the client rather than on these calls:
 * `ConvexBetterAuthProvider` sets the token on `convex` itself, so a signed-out
 * device reaches `requireUserId` and is refused there. Nothing here decides who
 * the caller is, which is the point — the server never accepts a user id as an
 * argument.
 */
export function syncTransport(): { push: PushFn; pull: PullFn } | null {
	if (!convex) {
		return null;
	}
	return {
		push: async (args) => convex.mutation("sync:push" as never, args as never),
		pull: async (args) =>
			convex.query("sync:pullSince" as never, args as never),
	};
}

/**
 * A live subscription to the account's replication watermark, or null when there
 * is no backend. Returns the unsubscribe.
 *
 * This is the one call in this file that is not request/response, and it is what
 * makes replication realtime: any device's push moves the watermark, which
 * invalidates the query on every other device and delivers a value here without
 * anybody polling.
 *
 * A refusal is swallowed rather than surfaced. A signed-out device reaches
 * `requireUserId` and is turned away, and the subscription has to survive that —
 * the same socket delivers a number as soon as `ConvexBetterAuthProvider` sets a
 * token, so tearing it down on the first error would mean no realtime until the
 * next remount.
 */
export function watchSyncWatermark(
	onWatermark: (watermark: number) => void,
): (() => void) | null {
	if (!convex) {
		return null;
	}
	const watch = convex.watchQuery("sync:currentSeq" as never, {} as never);
	return watch.onUpdate(() => {
		let watermark: unknown;
		try {
			watermark = watch.localQueryResult();
		} catch {
			return;
		}
		if (typeof watermark === "number") {
			onWatermark(watermark);
		}
	});
}

/**
 * The photo transport, or null when there is no backend.
 *
 * The bytes never touch Convex: the signed urls address R2 directly, so a
 * multi-megabyte PUT is not a mutation argument and does not count against any
 * function limit. Only the three small calls that mint and account for those
 * urls go through the client, and they authenticate exactly as `syncTransport`
 * does — on the client, never on an argument.
 */
export function photoTransport(): PhotoTransport | null {
	if (!convex) {
		return null;
	}
	return {
		requestUpload: async (name) =>
			convex.mutation("photos:requestUpload" as never, { name } as never),
		confirmUpload: async (key, storageId) => {
			await convex.action(
				"photos:confirmUpload" as never,
				(storageId ? { key, storageId } : { key }) as never,
			);
		},
		readUrls: async (keys) =>
			convex.query(
				"photos:readUrls" as never,
				{
					keys: [...keys],
				} as never,
			),
		release: async (key) => {
			await convex.mutation(
				"photos:releaseUnreferenced" as never,
				{ key } as never,
			);
		},
		put: async (url, bytes) => {
			const response = await fetch(url, {
				method: "PUT",
				body: bytes as unknown as BodyInit,
				headers: { "Content-Type": "image/jpeg" },
			});
			if (!response.ok) {
				throw new Error(`Photo upload failed: ${response.status}`);
			}
			// Convex file storage answers the PUT with the id it allocated; R2
			// answers with nothing, because its key is already the address.
			try {
				const body = (await response.json()) as { storageId?: string };
				return body.storageId ?? null;
			} catch {
				return null;
			}
		},
		get: async (url) => {
			const response = await fetch(url);
			if (response.status === 404 || response.status === 403) {
				// Gone, or the url outlived its signature. Both are the same thing to
				// the caller: no bytes this pass, try again next one.
				return null;
			}
			if (!response.ok) {
				throw new Error(`Photo download failed: ${response.status}`);
			}
			return new Uint8Array(await response.arrayBuffer());
		},
	};
}
