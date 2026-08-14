import type { PhotoTransport } from "@/data/photo-sync-core";
import type { PullRatesFn } from "@/data/rates";
import type { PullFn, PushFn } from "@/data/sync-engine-core";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";

import { cloudRuntime } from "./cloud-runtime";
import type { CloudRuntime } from "./cloud-runtime";

export const convex = cloudRuntime?.convex ?? null;

function cloudClient(): CloudRuntime["convex"] {
    if (cloudRuntime === null) {
        throw new Error("Cloud runtime is not configured");
    }
    return cloudRuntime.convex;
}

export function ratesPuller(): PullRatesFn {
    return async (args) =>
        // Addressed by path rather than through the generated API:
        // `packages/backend` is not a build dependency of the app, and the wire
        // shape is pinned by `PullRatesPage` plus the backend's own tests.
        cloudClient().query("exchangeRates:pullRates" as never, (args ?? {}) as never);
}

/**
 * The replication transport.
 *
 * Authentication rides on the client rather than on these calls:
 * `ConvexBetterAuthProvider` sets the token on `convex` itself, so a signed-out
 * device reaches `requireUserId` and is refused there. Nothing here decides who
 * the caller is, which is the point — the server never accepts a user id as an
 * argument.
 */
export function syncTransport(): { push: PushFn; pull: PullFn } {
    return {
        pull: async (args) => cloudClient().query("sync:pullSince" as never, args as never),
        push: async (args) => cloudClient().mutation("sync:push" as never, args as never),
    };
}

/**
 * A live subscription to the account's replication watermark. Returns the
 * unsubscribe.
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
export function watchSyncWatermark(onWatermark: (watermark: number) => void): () => void {
    if (cloudRuntime === null) {
        return () => undefined;
    }
    const watch = cloudRuntime.convex.watchQuery("sync:currentSeq" as never, {} as never);
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

export interface CategoryBranch {
    children: string[];
    name: string;
}

export interface EnrichmentRequest {
    /** Names only — the shape of the ledger, never its figures. */
    categoryTree: CategoryBranch[];
    /** The synced `groundedLookup` setting; the server re-checks it too. */
    groundedLookup: boolean;
    income: boolean;
    knowledgeOnly?: boolean;
    locale?: string;
    name: string;
    /**
     * The device's own region — a signal `locale` cannot substitute for, since a
     * user may run an English UI on a device set to a different region.
     */
    regionCode?: string;
}

export type EnrichmentFn = (args: EnrichmentRequest) => Promise<RemoteEnrichmentResult>;

/**
 * Only the merchant name and the user's own category names are sent — the
 * action's argument validator is asserted against that exact field set in
 * `packages/backend/convex/enrichment.test.ts`, so amounts, dates, accounts
 * and balances cannot be added here without failing that test.
 *
 * Signed-out callers are refused server-side and answered with the empty
 * suggestion rather than an error, so there is no client-side identity check
 * to keep in step: authentication rides on `convex` itself, exactly as it does
 * for `syncTransport`.
 */
export function enrichmentTransport(): EnrichmentFn {
    return async (args) => cloudClient().action("enrichment:suggest" as never, args as never);
}

export interface LabelSuggestion {
    categoryName: string;
    /** Absent from a backend deployed before the merchantKnowledge tier. */
    domain?: string | null;
    label: string;
}

export type CsvImportStatus =
    | "ok"
    | "unauthenticated"
    | "notConfigured"
    | "rateLimited"
    | "invalid"
    | "providerError"
    | "invalidResponse";

export interface CsvImportResult {
    degraded?: boolean;
    status: CsvImportStatus;
    suggestions: LabelSuggestion[] | null;
}

export interface CsvImportRequest {
    categoryTree: CategoryBranch[];
    /** The synced `groundedLookup` setting; the server re-checks it too. */
    groundedLookup?: boolean;
    labels: string[];
    regionCode?: string;
}

export type CsvImportFn = (args: CsvImportRequest) => Promise<CsvImportResult>;

/**
 * Args are `{labels, categoryTree}` plus the grounded consent flag and device
 * region — the same privacy boundary the action's own validator asserts in
 * `packages/backend/convex/csvImport.ts`. Authentication rides on `convex`
 * itself, exactly as it does for `enrichmentTransport`.
 */
export function csvImportTransport(): CsvImportFn {
    return async (args) => cloudClient().action("csvImport:csvImport" as never, args as never);
}

/**
 * The bytes never touch Convex: the signed urls address R2 directly, so a
 * multi-megabyte PUT is not a mutation argument and does not count against any
 * function limit. Only the three small calls that mint and account for those
 * urls go through the client, and they authenticate exactly as `syncTransport`
 * does — on the client, never on an argument.
 */
export function photoTransport(): PhotoTransport {
    return {
        confirmUpload: async (key, storageId) => {
            await cloudClient().action(
                "photos:confirmUpload" as never,
                (storageId ? { key, storageId } : { key }) as never
            );
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
        put: async (url, bytes) => {
            const response = await fetch(url, {
                body: bytes as unknown as BodyInit,
                headers: { "Content-Type": "image/jpeg" },
                method: "PUT",
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
        readUrls: async (keys) =>
            cloudClient().query(
                "photos:readUrls" as never,
                {
                    keys: [...keys],
                } as never
            ),
        release: async (key) => {
            await cloudClient().mutation("photos:releaseUnreferenced" as never, { key } as never);
        },
        requestUpload: async (name) => cloudClient().mutation("photos:requestUpload" as never, { name } as never),
    };
}
